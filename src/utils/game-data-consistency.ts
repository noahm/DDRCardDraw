import type { GameData, I18NDict } from "../models/SongData.ts";

/**
 * Checks a schema-valid GameData file for internal consistency the schema can't
 * express: every style, difficulty and flag it uses is declared in `meta` and has
 * a translation, defaults point at things that exist, and so on. Shared by
 * `scripts/validate.mjs` (for bundled data) and the custom-data upload form (for
 * premade files), so both hold data to the same rules.
 *
 * Kept free of runtime imports so the validate script can load it directly with
 * Node's type stripping.
 *
 * @param jacketExists checks a song or chart's jacket path; the validate script
 * passes one that looks in the jackets folder. Jackets aren't checked without it.
 * @returns every problem found, or an empty list if there are none
 */
export function findConsistencyErrors(
  dataFile: GameData,
  jacketExists?: (jacket: string) => boolean,
): string[] {
  const errors = new Set<string>();

  const allKeys = [
    ...dataFile.meta.styles,
    ...dataFile.meta.difficulties.map((d) => d.key),
    ...dataFile.meta.flags,
  ];
  const styles = new Set(dataFile.meta.styles);
  const difficulties = new Set(dataFile.meta.difficulties.map((d) => d.key));
  const folders = new Set(dataFile.meta.folders);
  const en: I18NDict | undefined = dataFile.i18n.en;
  const abbr = en?.["$abbr"];

  if (dataFile.defaults.style && !styles.has(dataFile.defaults.style)) {
    errors.add("default style is not listed in meta");
  }

  if (dataFile.defaults.difficulties.some((d) => !difficulties.has(d))) {
    errors.add("some default difficulties are missing from meta");
  }

  if (dataFile.defaults.lowerLvlBound > dataFile.defaults.upperLvlBound) {
    errors.add("default level bounds are reversed");
  }

  for (const key of allKeys) {
    if (!en?.[key]) {
      errors.add("missing translation for " + key);
    }
    if (difficulties.has(key) && !(typeof abbr === "object" && abbr[key])) {
      errors.add("missing abbreviated translation for " + key);
    }
  }

  for (const song of dataFile.songs) {
    if (dataFile.meta.folders && song.folder) {
      if (!folders.has(song.folder)) {
        errors.add(`top level folders list is missing ${song.folder}`);
      }
    }
    if (song.jacket && jacketExists && !jacketExists(song.jacket)) {
      errors.add(`missing jacket image ${song.jacket}`);
    }

    for (const chart of song.charts) {
      if (!styles.has(chart.style)) {
        errors.add(`unrecognized style "${chart.style}" used by ${song.name}`);
      }
      if (!difficulties.has(chart.diffClass)) {
        errors.add(
          `unrecognized diffClass "${chart.diffClass}" used by ${song.name}`,
        );
      }
      if (chart.jacket && jacketExists && !jacketExists(chart.jacket)) {
        errors.add(`missing jacket image ${chart.jacket}`);
      }
      if (dataFile.meta.usesDrawGroups) {
        if (!chart.drawGroup) {
          errors.add(`${song.name} is missing a draw group`);
        }
      }
    }
  }

  for (const err of findDuplicateChartIds(dataFile)) {
    errors.add(err);
  }

  return [...errors];
}

/**
 * A chart's `id`, where one is given, has to be unique within its file: it
 * overrides the identity the app otherwise derives from the song and chart
 * fields (see `src/chart-id.ts`), and chart identity is what the event-wide
 * "never draw the same chart twice" rule is built on. Two charts sharing an id
 * would silently make one of them undrawable once the other had been drawn.
 *
 * Ids are compared across files as well, so an id reused for a different chart
 * in another file has the same effect between them. That can't be checked from
 * one file alone, but giving the same chart the same id in two files is the
 * intended way to say they are the same chart.
 */
function findDuplicateChartIds(dataFile: GameData): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const song of dataFile.songs) {
    for (const chart of song.charts) {
      if (!chart.id) continue;
      const owner = seen.get(chart.id);
      if (owner) {
        errors.push(
          `chart id "${chart.id}" is used by both ${owner} and ${song.name}`,
        );
      } else {
        seen.set(chart.id, song.name);
      }
    }
  }
  return errors;
}

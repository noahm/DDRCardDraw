/**
 * Stable identity for a chart, as opposed to `DrawnChart.id` — which is a fresh
 * nanoid minted for each drawn copy and says nothing about *which* chart it is.
 *
 * A chart may carry an explicit `id` in its data file, but almost none do, so
 * the key is normally derived from its song's `id` (unique within a file) and
 * the chart's own fields. A song can still hold more than one chart in the same
 * style and difficulty, and custom bundles published before songs had ids get
 * one at load (see `utils/legacy-game-data.ts`), so two things close the gap:
 *
 * - `extras` participates in the key. maimai's same-slot collisions are real,
 *   distinct charts separated only by `extras: ["dx"]` vs `["std"]`, and SMX
 *   edits all share `diffClass: "edit"` and are separated by `editId:…`.
 * - a `#2`/`#3`… ordinal, assigned in file order, settles whatever is left
 *   (mostly songs duplicated outright within one file).
 *
 * A key deliberately identifies a *chart*, not a chart-in-a-file: it carries no
 * game key, so the same chart reached through two data files answers to the
 * same key. That is what a tournament organizer means by "don't repeat a
 * chart" when an event draws from both a curated pack and the base game it was
 * cut from — `dia_del_ritmo_26` shares every one of its keys with `ddr_world`,
 * and `a3` shares 8444 of 8714. The risk this trades against is two unrelated
 * games conflating a chart that happens to share a name and rating; measured
 * across the corpus that is zero, because the key also carries artist, style,
 * diffClass, level and extras (DDR↔ITG, DDR↔Pump, ITG↔SMX and maimai↔ongeki
 * all share nothing).
 */

import { EligibleChart } from "./models/Drawing";
import { Chart, GameData, Song } from "./models/SongData";

const PART_SEP = "::";
const FIELD_SEP = "|";

/**
 * A stable identity for a chart within one song. Normal charts are unique by
 * style+diffClass, but edit charts all share `diffClass: "edit"` and maimai's
 * DX and standard charts share everything but their `extras`, so we key on the
 * level and the full extras set too. This both distinguishes genuinely
 * different charts and lets us collapse the same one grafted onto a song more
 * than once.
 */
export function chartIdentity(chart: Chart): string {
  return [
    chart.style,
    chart.diffClass,
    chart.lvl,
    (chart.extras || []).slice().sort().join(","),
  ].join(FIELD_SEP);
}

function songIdentity(song: Song): string {
  return song.id;
}

/** the key a chart claims before any ordinal is applied for collisions */
function baseKey(song: Song, chart: Chart): string {
  return chart.id || `${songIdentity(song)}${PART_SEP}${chartIdentity(chart)}`;
}

/**
 * Built once per loaded `GameData` and held weakly, so it dies with the cached
 * game data rather than pinning it. Keyed on the `Chart` objects themselves:
 * the data files are loaded once and never mutated in place, and the SMX edit
 * import clones into fresh objects, so object identity is a safe handle.
 */
const indexCache = new WeakMap<GameData, Map<Chart, string>>();

function buildIndex(gameData: GameData): Map<Chart, string> {
  const keys = new Map<Chart, string>();
  /** how many charts have already claimed each base key, in file order */
  const claimed = new Map<string, number>();
  for (const song of gameData.songs) {
    for (const chart of song.charts) {
      const base = baseKey(song, chart);
      const priorClaims = claimed.get(base) || 0;
      claimed.set(base, priorClaims + 1);
      keys.set(chart, priorClaims ? `${base}#${priorClaims + 1}` : base);
    }
  }
  return keys;
}

/** the stable key identifying `chart`, wherever it was loaded from */
export function chartKeyFor(
  gameData: GameData,
  song: Song,
  chart: Chart,
): string {
  let index = indexCache.get(gameData);
  if (!index) {
    index = buildIndex(gameData);
    indexCache.set(gameData, index);
  }
  // a chart grafted on after the index was built still deserves an answer,
  // even without an ordinal to disambiguate it from a twin
  return index.get(chart) || baseKey(song, chart);
}

/**
 * The coarse key that charts drawn before `chartKey` existed can still be
 * matched on. It's the same `name`/`diffAbbr`/`level` triple the draw code has
 * always used to spot a duplicate, and it's much more approximate than
 * {@link chartKeyFor} — it carries no artist, style or extras, so unrelated
 * games really can collide here. That's tolerable where it only causes a chart
 * to be skipped, and not where it would reject a draw outright, so only
 * {@link reuseKeysForChart} hands it out.
 */
function legacyReuseKey(chart: EligibleChart): string {
  return ["legacy", chart.name, chart.diffAbbr, chart.level].join(FIELD_SEP);
}

/**
 * The key `chart` had before songs carried an `id`, when a song was identified
 * by its `saHash` or, lacking one, its name and artist. Songs whose `id` is
 * their old `saHash` kept their keys; for the rest, this is the key charts
 * drawn before the switch were stored under. Unlike {@link chartKeyFor} it
 * can't recover a `#2` ordinal, and two songs sharing a name and artist share
 * it, so like the legacy key it's only for excluding charts.
 */
function preSongIdReuseKey(chart: EligibleChart): string | undefined {
  const style = styleOfChart(chart);
  const diffClass = diffClassOfChart(chart);
  if (!style || !diffClass) {
    return undefined;
  }
  const chartPart = [
    style,
    diffClass,
    chart.level,
    (chart.extras || []).slice().sort().join(","),
  ].join(FIELD_SEP);
  return `${chart.name}${FIELD_SEP}${chart.artist}${PART_SEP}${chartPart}`;
}

/**
 * Every key by which `chart` should be recognized as already used. Use this to
 * *exclude* charts from a draw, where over-matching only costs a skipped chart.
 * Use `chart.chartKey` alone where a false match would be worse than a miss.
 */
export function reuseKeysForChart(chart: EligibleChart): string[] {
  const keys = [
    chart.chartKey,
    preSongIdReuseKey(chart),
    legacyReuseKey(chart),
  ];
  return [...new Set(keys.filter((key): key is string => !!key))];
}

/**
 * The most precise key `chart` can be recognized by: its own `chartKey` where
 * it has one, and the coarse legacy key where it predates them. Use this to
 * count or dedupe distinct charts, where {@link reuseKeysForChart} would hand
 * back several keys for the same one.
 */
export function primaryReuseKey(chart: EligibleChart): string {
  return chart.chartKey || legacyReuseKey(chart);
}

/**
 * Reads one field of {@link chartIdentity} back out of a derived `chartKey`,
 * for charts drawn before that field was stored on them directly. A chart keyed
 * by an explicit data-file `id`, or with no key at all, has nothing to report.
 */
function chartKeyField(
  chart: EligibleChart,
  field: "style" | "diffClass",
): string | undefined {
  const sep = chart.chartKey?.lastIndexOf(PART_SEP) ?? -1;
  if (!chart.chartKey || sep < 0) {
    return undefined;
  }
  const fields = chart.chartKey.slice(sep + PART_SEP.length).split(FIELD_SEP);
  return fields[field === "style" ? 0 : 1] || undefined;
}

/** the play style `chart` was drawn from, if it can still be known */
export function styleOfChart(chart: EligibleChart): string | undefined {
  return chart.style || chartKeyField(chart, "style");
}

/** the difficulty class `chart` was drawn from, if it can still be known */
export function diffClassOfChart(chart: EligibleChart): string | undefined {
  return chart.diffClass || chartKeyField(chart, "diffClass");
}

/** true if any key identifying `chart` is present in `used` */
export function chartIsUsed(
  chart: EligibleChart,
  used: ReadonlySet<string>,
): boolean {
  return reuseKeysForChart(chart).some((key) => used.has(key));
}

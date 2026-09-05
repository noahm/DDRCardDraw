/**
 * Stable identity for a chart, as opposed to `DrawnChart.id` — which is a fresh
 * nanoid minted for each drawn copy and says nothing about *which* chart it is.
 *
 * A chart may carry an explicit `id` in its data file, but almost none do, so
 * the key is normally derived from the song's and chart's own fields. Deriving
 * it is not quite as simple as it looks: across the data files in `src/songs`,
 * `(name, artist, style, diffClass, lvl)` is not unique (donkeykonga, pump and
 * maimai all collide), and neither is `saHash`. Two things close the gap:
 *
 * - `extras` participates in the key. maimai's same-slot collisions are real,
 *   distinct charts separated only by `extras: ["dx"]` vs `["std"]`, and SMX
 *   edits all share `diffClass: "edit"` and are separated by `editId:…`.
 * - a `#2`/`#3`… ordinal, assigned in file order, settles whatever is left
 *   (mostly songs duplicated outright within one file).
 *
 * Keys are namespaced by `gameKey` so a room drawing from two games can't
 * conflate charts that happen to share a name and rating.
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
  return song.saHash || `${song.name}${FIELD_SEP}${song.artist}`;
}

interface KeyIndex {
  gameKey: string;
  keys: Map<Chart, string>;
}

/**
 * Built once per loaded `GameData` and held weakly, so it dies with the cached
 * game data rather than pinning it. Keyed on the `Chart` objects themselves:
 * the data files are loaded once and never mutated in place, and the SMX edit
 * import clones into fresh objects, so object identity is a safe handle.
 */
const indexCache = new WeakMap<GameData, KeyIndex>();

function buildIndex(gameData: GameData, gameKey: string): KeyIndex {
  const keys = new Map<Chart, string>();
  /** how many charts have already claimed each base key, in file order */
  const claimed = new Map<string, number>();
  for (const song of gameData.songs) {
    const song_ = songIdentity(song);
    for (const chart of song.charts) {
      const base = chart.id
        ? `${gameKey}${PART_SEP}${chart.id}`
        : `${gameKey}${PART_SEP}${song_}${PART_SEP}${chartIdentity(chart)}`;
      const priorClaims = claimed.get(base) || 0;
      claimed.set(base, priorClaims + 1);
      keys.set(chart, priorClaims ? `${base}#${priorClaims + 1}` : base);
    }
  }
  return { gameKey, keys };
}

/** the stable key identifying `chart` within the game data it came from */
export function chartKeyFor(
  gameData: GameData,
  gameKey: string,
  chart: Chart,
): string {
  let index = indexCache.get(gameData);
  // the same game data is only ever cached under one key, but rebuild rather
  // than hand back keys namespaced to the wrong game if that ever changes
  if (!index || index.gameKey !== gameKey) {
    index = buildIndex(gameData, gameKey);
    indexCache.set(gameData, index);
  }
  // a chart grafted on after the index was built (or one from other game data)
  // still deserves an answer, even without an ordinal to disambiguate it
  return (
    index.keys.get(chart) || `${gameKey}${PART_SEP}${chartIdentity(chart)}`
  );
}

/**
 * The coarse key that charts drawn before `chartKey` existed can still be
 * matched on. It's the same `name`/`diffAbbr`/`level` triple the draw code has
 * always used to spot a duplicate, and it's just as approximate — two games in
 * one room can collide here. That's tolerable where it only causes a chart to
 * be skipped, and not where it would reject a draw outright, so only
 * {@link reuseKeysForChart} hands it out.
 */
function legacyReuseKey(chart: EligibleChart): string {
  return ["legacy", chart.name, chart.diffAbbr, chart.level].join(FIELD_SEP);
}

/**
 * Every key by which `chart` should be recognized as already used. Use this to
 * *exclude* charts from a draw, where over-matching only costs a skipped chart.
 * Use `chart.chartKey` alone where a false match would be worse than a miss.
 */
export function reuseKeysForChart(chart: EligibleChart): string[] {
  const legacy = legacyReuseKey(chart);
  return chart.chartKey ? [chart.chartKey, legacy] : [legacy];
}

/** true if any key identifying `chart` is present in `used` */
export function chartIsUsed(
  chart: EligibleChart,
  used: ReadonlySet<string>,
): boolean {
  return reuseKeysForChart(chart).some((key) => used.has(key));
}

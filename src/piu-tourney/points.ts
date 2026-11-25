/**
 * The gauntlet payout table, split out from ./index so consumers that only
 * need the scoring math (OBS sources, standings) don't pull in the Supabase
 * client along with it.
 */

/**
 * What tourney-maker seeds a gauntlet round with. Used when a round leaves
 * points_per_stage unset, which roughly 40% of rounds in that project do.
 */
export const DEFAULT_POINTS_PER_PLACE: readonly number[] = [5, 3, 2, 1];

/**
 * `points_per_stage` is a comma separated payout table, highest place first:
 * "5,3,2,1" pays 5 for winning a stage, 3 for placing second, and so on. One
 * entry per place, awarded per drawn chart rather than per round.
 *
 * It is a free text field organizers hand edit, so nothing guarantees its
 * length matches the size of a heat — tourney 97 ran heats of four off an
 * eleven entry table. Callers must therefore treat it as "points for place N,
 * or nothing past the end" and must not read a group size out of it. Repeated
 * values are legal and express a tie.
 */
export function parsePointsPerPlace(raw: string | null): number[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((piece) => Number.parseInt(piece.trim(), 10))
    .filter((n) => Number.isSafeInteger(n));
  return parsed.length ? parsed : [...DEFAULT_POINTS_PER_PLACE];
}

/** Points a given finishing place earns on one chart. `place` is 1 indexed. */
export function pointsForPlace(
  pointsPerPlace: readonly number[],
  place: number,
) {
  return pointsPerPlace[place - 1] ?? 0;
}

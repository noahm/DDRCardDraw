import { pointsForPlace } from "../piu-tourney/points";
import {
  type Drawing,
  type GauntletScoredMeta,
  type Player,
  type ScoreableChart,
  isGauntletScored,
  playerDisplayName,
  scoreableCharts,
} from "./Drawing";
import { payoutTableFromScheme } from "./payout-scheme";

/** What one player earned on one played chart. */
export interface ChartResult {
  score: number;
  /** 1 indexed finishing place on this chart; tied scores share a place */
  place: number;
  points: number;
}

export interface StandingsRow {
  player: Player;
  /** already falls back to the positional placeholder for unnamed players */
  name: string;
  /** keyed by chart id, absent for charts this player has no score on */
  results: Record<string, ChartResult | undefined>;
  totalPoints: number;
  /** sum of raw scores, used only to break ties in display order */
  totalScore: number;
  /** 1 indexed standing; players level on points share a place */
  place: number;
}

export interface GauntletStandings {
  /** the payout table these standings were scored against */
  pointsPerPlace: readonly number[];
  /** every card that can be scored, played or not, in the order drawn */
  charts: ScoreableChart[];
  /** cards somebody has a score on, in the order they were drawn */
  playedCharts: ScoreableChart[];
  /** every player in the gauntlet, best total first */
  rows: StandingsRow[];
}

/**
 * The points table a gauntlet pays out on, most specific source first:
 *
 * 1. the table a piu round was drawn against, snapshotted at draw time, which
 *    is its organizer's own and not ours to reinterpret;
 * 2. the scheme this draw was taken under, likewise snapshotted;
 * 3. the event's scheme, for draws taken before that was recorded;
 * 4. the built-in default.
 *
 * Everything below the table is resolved against the size of the heat right
 * now, so a late entrant is paid out for rather than ignored.
 */
export function payoutTableFor(
  meta: GauntletScoredMeta,
  eventScheme?: string,
): readonly number[] {
  if ("pointsPerPlace" in meta && meta.pointsPerPlace?.length) {
    return meta.pointsPerPlace;
  }
  return payoutTableFromScheme(
    meta.payoutScheme || eventScheme,
    meta.players.length,
  );
}

/**
 * Scores a gauntlet round into a standings table: every player, what they
 * scored and earned on each chart that's actually been played, and their
 * running total.
 *
 * A chart counts as played once *anyone* has a score on it, so a column
 * appears as soon as the first score of a song is typed in rather than waiting
 * on the whole heat. Places are competition ranked (two players level on a
 * chart both take the higher place, and the next player down skips one), which
 * is what makes a hand written payout table like "5,5,2,1" pay the tie the way
 * its author meant it to.
 */
export function computeGauntletStandings(
  meta: GauntletScoredMeta,
  charts: ScoreableChart[],
  eventScheme?: string,
): GauntletStandings {
  const pointsPerPlace = payoutTableFor(meta, eventScheme);
  const scores = meta.scoresByEntrant ?? {};
  const scoreOf = (playerId: string, chartId: string) => {
    const score = scores[playerId]?.[chartId];
    return typeof score === "number" ? score : undefined;
  };

  const playedCharts = charts.filter((chart) =>
    meta.players.some((p) => scoreOf(p.id, chart.id) !== undefined),
  );

  const rows = meta.players.map<StandingsRow>((player, index) => ({
    player,
    name: playerDisplayName(player, index),
    results: {},
    totalPoints: 0,
    totalScore: 0,
    place: 0,
  }));
  const rowsById = new Map(rows.map((row) => [row.player.id, row]));

  for (const chart of playedCharts) {
    const ranked = meta.players
      .flatMap((player) => {
        const score = scoreOf(player.id, chart.id);
        return score === undefined ? [] : [{ id: player.id, score }];
      })
      .sort((a, b) => b.score - a.score);

    let place = 0;
    let priorScore: number | undefined;
    ranked.forEach((entry, index) => {
      // only a strictly lower score moves the place along, so a tie hands both
      // players the same place and leaves a gap below them
      if (entry.score !== priorScore) {
        place = index + 1;
        priorScore = entry.score;
      }
      // every ranked id came out of meta.players, so the row always exists
      const row = rowsById.get(entry.id)!;
      const points = pointsForPlace(pointsPerPlace, place);
      row.results[chart.id] = { score: entry.score, place, points };
      row.totalPoints += points;
      row.totalScore += entry.score;
    });
  }

  rows.sort(
    (a, b) => b.totalPoints - a.totalPoints || b.totalScore - a.totalScore,
  );

  let place = 0;
  let priorPoints: number | undefined;
  rows.forEach((row, index) => {
    if (row.totalPoints !== priorPoints) {
      place = index + 1;
      priorPoints = row.totalPoints;
    }
    row.place = place;
  });

  return { pointsPerPlace, charts, playedCharts, rows };
}

/**
 * Every card of a whole match somebody can post a score on, across all of its
 * sub-draws. Pocket picks and free picks come through as the chart actually
 * played on them, so points are paid out on those the same as on anything else
 * drawn.
 */
export function playableCharts(
  drawing: Pick<Drawing, "subDrawings" | "bans" | "pocketPicks">,
): ScoreableChart[] {
  return Object.values(drawing.subDrawings ?? {}).flatMap((subDraw) =>
    scoreableCharts(subDraw.charts, drawing),
  );
}

/**
 * The number that belongs beside each player's name, keyed by player id.
 *
 * A head to head match counts the cards a player is marked the winner of. A
 * gauntlet has no "the other player" to win a card against, so it counts what
 * the payout scheme has paid that player so far — the same totals the standings
 * table adds up, taken over every sub-draw of the match.
 *
 * Undefined when there's nothing to show yet: a gauntlet nobody has scored
 * would badge the entire field with a zero, which reads as a result rather than
 * an empty scoreboard.
 */
export function playerScores(
  drawing: Pick<
    Drawing,
    "meta" | "winners" | "subDrawings" | "bans" | "pocketPicks"
  >,
  eventScheme?: string,
): ReadonlyMap<string, number> | undefined {
  if (isGauntletScored(drawing.meta)) {
    const { playedCharts, rows } = computeGauntletStandings(
      drawing.meta,
      playableCharts(drawing),
      eventScheme,
    );
    if (!playedCharts.length) {
      return undefined;
    }
    return new Map(rows.map((row) => [row.player.id, row.totalPoints]));
  }

  // a player with no wins still reads 0 rather than dropping their badge
  const wins = new Map(drawing.meta.players.map((player) => [player.id, 0]));
  for (const winner of Object.values(drawing.winners)) {
    if (winner === null) {
      continue;
    }
    wins.set(winner, (wins.get(winner) ?? 0) + 1);
  }
  return wins;
}

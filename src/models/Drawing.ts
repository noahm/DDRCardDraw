import { nanoid } from "nanoid";

export interface EligibleChart {
  /**
   * Stable identity for this chart in the game data it came from, unlike
   * `DrawnChart.id` which is unique to a single drawn copy. Optional only
   * because charts drawn before this existed are still in people's saved
   * history; see `src/chart-id.ts`.
   */
  chartKey?: string;
  name: string;
  jacket: string;
  nameTranslation?: string;
  artist: string;
  artistTranslation?: string;
  bpm: string;
  diffAbbr: string;
  diffColor: string;
  level: number;
  granularLevel?: number;
  maxScore?: number;
  drawGroup?: number;
  flags: string[];
  extras: string[];
  cardVariant: string | undefined;
  dateAdded?: string;
  songId?: string;
  folder?: string;
}

export const CHART_PLACEHOLDER = "PLACEHOLDER";

export interface PlayerPickPlaceholder {
  id: string;
  type: typeof CHART_PLACEHOLDER;
}

export const CHART_DRAWN = "DRAWN";
export interface DrawnChart extends EligibleChart {
  id: string;
  type: typeof CHART_DRAWN;
}

export interface Player {
  id: string;
  name: string;
  /** free-form, as published by the player (e.g. from their start.gg profile) */
  pronouns?: string;
}

/** create a new player with a freshly-generated unique id */
export function newPlayer(name: string): Player {
  return { id: nanoid(10), name };
}

export interface PlayerActionOnChart {
  /** id of the player who took the action */
  player: string;
  chartId: string;
}

export interface PocketPick extends PlayerActionOnChart {
  pick: EligibleChart;
}

interface DrawMeta {
  title: string;
  players: Player[];
  /**
   * What everyone scored: first index is player ID, second index is the id of
   * the card it was scored on (see `ScoreableChart`).
   *
   * Every kind of draw records these rather than the gauntlet metas alone:
   * head to head matches need them because a bracket that ranks by score
   * (piu-tourney-maker does) can't advance on win counts, and a custom draw
   * run outside any bracket still wants somewhere to keep them.
   */
  scoresByEntrant?: Record<string, Record<string, number | undefined>>;
  /**
   * The payout scheme this draw was taken under, copied off the event when it
   * was created, in the notation `src/models/payout-scheme.ts` describes.
   *
   * It's a copy rather than a live read so that changing what the event pays
   * out settles how the next round scores without quietly rewriting a round
   * already on the board. Still a scheme and not a table, so a heat that gains
   * a player after the draw pays that player out too. Absent on draws taken
   * before this was recorded, which fall back to the event's.
   */
  payoutScheme?: string;
}

/** Shared by every draw sourced from an external bracket, head to head or not. */
interface ExternalMetaBase extends DrawMeta {
  phaseName: string;
}

interface StartggMeta extends ExternalMetaBase {
  type: "startgg";
}

export interface StartggVersusMeta extends StartggMeta {
  subtype: "versus";
  /** id of the set */
  id: string;
}

export interface StartggGauntletMeta extends StartggMeta {
  subtype: "gauntlet";
  /** id of the phase */
  id: string;
}

interface PiuMeta extends ExternalMetaBase {
  type: "piu";
  /** id of the piu-tourney-maker tourney, for linking back */
  tourneyId: string;
}

export interface PiuVersusMeta extends PiuMeta {
  subtype: "versus";
  /** id of the tourney-maker round — one round is one match */
  id: string;
}

export interface PiuGauntletMeta extends PiuMeta {
  subtype: "gauntlet";
  /** id of the tourney-maker round holding every entrant */
  id: string;
  /**
   * Points each finishing place earns on one chart, highest place first, as
   * configured on the tourney-maker round. Snapshotted at draw time so a draw
   * keeps paying out the way it did when it was taken, even if the organizer
   * edits the round afterward.
   *
   * Places past the end of the table earn nothing. Absent on draws taken
   * before this was recorded.
   */
  pointsPerPlace?: number[];
}

export interface SimpleMeta extends DrawMeta {
  type: "simple";
}

/** any draw sourced from an external bracket, as opposed to a custom draw */
export type ExternalMeta =
  | StartggVersusMeta
  | StartggGauntletMeta
  | PiuVersusMeta
  | PiuGauntletMeta;

/**
 * A draw covering a whole group of players at once rather than a head to head
 * match. These score by total points instead of per-chart wins.
 */
export type GauntletMeta = StartggGauntletMeta | PiuGauntletMeta;

/** any draw that ranks a group on total points: a gauntlet by another name */
export type GauntletScoredMeta = GauntletMeta | SimpleMeta;

export function isExternalMeta(meta: Drawing["meta"]): meta is ExternalMeta {
  return meta.type === "startgg" || meta.type === "piu";
}

export function isGauntletMeta(meta: Drawing["meta"]): meta is GauntletMeta {
  return isExternalMeta(meta) && meta.subtype === "gauntlet";
}

/**
 * Whether a draw is scored as a gauntlet — ranked on total points rather than
 * settled chart by chart. A bracket says outright which of its matches is one;
 * a custom draw becomes one as soon as it holds more than a head to head pair,
 * since past two players there's no "the other player" to win against.
 */
export function isGauntletScored(
  meta: Drawing["meta"],
): meta is GauntletScoredMeta {
  return (
    isGauntletMeta(meta) || (meta.type === "simple" && meta.players.length > 2)
  );
}

/** Identifies an external match across providers, for de-duping draws. */
export function externalMatchKey(meta: ExternalMeta) {
  return `${meta.type}:${meta.id}`;
}

/** a player's name, falling back to a positional placeholder when unnamed */
export function playerDisplayName(player: Player, index: number) {
  return player.name || `P${index + 1}`;
}

export function getAllPlayers(d: Pick<Drawing, "meta">) {
  return d.meta.players.map(playerDisplayName);
}

export function playerById(meta: Drawing["meta"], id: string) {
  return meta.players.find((p) => p.id === id);
}

/**
 * Display name for a player id. A present-but-unnamed player falls back to its
 * positional placeholder (`P1`, `P2`, …); an id matching no player yields the
 * `fallback` (empty by default).
 */
export function playerNameById(
  meta: Drawing["meta"],
  id: string,
  fallback = "",
) {
  const index = meta.players.findIndex((p) => p.id === id);
  return index === -1
    ? fallback
    : playerDisplayName(meta.players[index], index);
}

/** used to reference a sub draw, or the charts in the parent draw by omitting the target */
export type CompoundSetId = [parentId: string, targetId: string];

export interface Drawing {
  id: string;
  configId: string;
  meta: SimpleMeta | ExternalMeta;
  /** map of song ID to the id of the winning player */
  winners: Record<string, string | null>;
  /** @deprecated migrating to subDraws */
  charts?: Array<DrawnChart | PlayerPickPlaceholder>;
  bans: Record<string, PlayerActionOnChart | null>;
  protects: Record<string, PlayerActionOnChart | null>;
  pocketPicks: Record<string, PocketPick | null>;
  /** id of the player who currently has priority, if any */
  priorityPlayer?: string;
  subDrawings: Record<string, SubDrawing>;
}

export interface SubDrawing {
  compoundId: CompoundSetId;
  configId: string;
  charts: Array<DrawnChart | PlayerPickPlaceholder>;
}

export type MergedDrawing = Drawing & SubDrawing;

/**
 * A card a score can be recorded against: the id scores are keyed by, plus the
 * chart actually played on it. The two differ whenever somebody's own pick
 * stands in — a pocket pick replacing a drawn chart, or a free pick filling a
 * placeholder — since scores stay keyed by the card that was drawn.
 */
export interface ScoreableChart {
  id: string;
  chart: EligibleChart;
  /** id of the player whose pocket pick or free pick this card is, if any */
  pickedBy?: string;
}

/**
 * Every card of a draw somebody can post a score on, in the order they were
 * drawn. Banned cards drop out, and so do player picks nobody has filled in
 * yet; everything else carries the chart that actually gets played on it.
 */
export function scoreableCharts(
  charts: Array<DrawnChart | PlayerPickPlaceholder>,
  { bans, pocketPicks }: Pick<Drawing, "bans" | "pocketPicks">,
): ScoreableChart[] {
  return charts.flatMap((card) => {
    if (bans[card.id]) {
      return [];
    }
    const pocketPick = pocketPicks[card.id];
    const chart =
      pocketPick?.pick || (card.type === CHART_DRAWN ? card : undefined);
    if (!chart) {
      return [];
    }
    return pocketPick
      ? [{ id: card.id, chart, pickedBy: pocketPick.player }]
      : [{ id: card.id, chart }];
  });
}

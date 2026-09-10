import { nanoid } from "nanoid";
import { Song } from "./SongData";

export interface EligibleChart {
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
  song: Song;
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
  /**
   * this player's StepManiaX gamer tag, learned when an operator confirms which
   * entrant a play from the global score feed belongs to. Later imports match
   * on it instead of guessing from the display name.
   */
  smxUsername?: string;
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
}

/**
 * Shared by every draw sourced from an external bracket, head to head or not.
 * Scores live here rather than on the gauntlet metas alone because head to head
 * matches record them too — a bracket that ranks by score (piu-tourney-maker
 * does) can't advance on win counts.
 */
interface ExternalMetaBase extends DrawMeta {
  phaseName: string;
  /** first index is player ID, second index is the drawn chart ID */
  scoresByEntrant?: Record<string, Record<string, number | undefined>>;
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

export function isExternalMeta(meta: Drawing["meta"]): meta is ExternalMeta {
  return meta.type === "startgg" || meta.type === "piu";
}

export function isGauntletMeta(meta: Drawing["meta"]): meta is GauntletMeta {
  return isExternalMeta(meta) && meta.subtype === "gauntlet";
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

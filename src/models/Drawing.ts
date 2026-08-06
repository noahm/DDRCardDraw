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

interface StartggMeta extends DrawMeta {
  type: "startgg";
  phaseName: string;
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
  /** first index is entrant ID, second index is the drawn chart ID */
  scoresByEntrant?: Record<string, Record<string, number | undefined>>;
}

export interface SimpleMeta extends DrawMeta {
  type: "simple";
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
  meta: SimpleMeta | StartggVersusMeta | StartggGauntletMeta;
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

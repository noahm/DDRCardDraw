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
  drawGroup?: number;
  flags: string[];
  dateAdded?: string;
  song: Song;
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

export interface PlayerActionOnChart {
  player: number;
  chartId: string;
}

export interface PocketPick extends PlayerActionOnChart {
  pick: EligibleChart;
}

interface StartggMeta {
  type: "startgg";
  title: string;
  entrants: Array<{ id: string; name: string }>;
  /** first index is entrant ID, second index is the drawn chart ID */
  scoresByEntrant?: Record<string, Record<string, number | undefined>>;
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

export interface SimpleMeta {
  type: "simple";
  title: string;
  /** plain player names */
  players: string[];
}

export function playerCount(meta: Drawing["meta"]) {
  switch (meta.type) {
    case "simple":
      return meta.players.length;
    case "startgg":
      return meta.entrants.length;
  }
}

export function getAllPlayers(d: Pick<Drawing, "playerDisplayOrder" | "meta">) {
  const ret = [] as string[];
  for (let i = 1; i <= playerCount(d.meta); i++) {
    ret.push(playerNameByDisplayPos(d, i));
  }
  return ret;
}

export function playerNameByDisplayPos(
  d: Pick<Drawing, "playerDisplayOrder" | "meta">,
  pos: number,
) {
  const playerIndex = d.playerDisplayOrder[pos - 1];
  return playerNameByIndex(d.meta, playerIndex);
}

export function playerNameByIndex(
  meta: Drawing["meta"],
  idx: number,
  fallback = `P${idx + 1}`,
) {
  switch (meta.type) {
    case "simple":
      return meta.players[idx] || fallback;
    case "startgg":
      return meta.entrants[idx].name || fallback;
  }
}

export interface Drawing {
  id: string;
  configId: string;
  meta: SimpleMeta | StartggVersusMeta | StartggGauntletMeta;
  /** index of items of the players array, in the order they should be displayed */
  playerDisplayOrder: number[];
  /** map of song ID to player index */
  winners: Record<string, number | null>;
  charts: Array<DrawnChart | PlayerPickPlaceholder>;
  bans: Record<string, PlayerActionOnChart | null>;
  protects: Record<string, PlayerActionOnChart | null>;
  pocketPicks: Record<string, PocketPick | null>;
  priorityPlayer?: number;
  subDrawings?: SubDrawing[];
}

export interface SubDrawing
  extends Pick<
    Drawing,
    "configId" | "charts" | "winners" | "bans" | "protects" | "pocketPicks"
  > {
  id: string;
  parentId: string;
}

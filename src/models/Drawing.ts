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

export interface StartggMeta {
  type: "startgg";
  /** id of the set */
  id: string;
  title: string;
  entrants: Array<{ id: string; name: string }>;
}

export interface SimpleMeta {
  type: "simple";
  title: string;
  /** plain player names */
  players: string[];
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
  meta: SimpleMeta | StartggMeta;
  /** index of items of the players array, in the order they should be displayed */
  playerDisplayOrder: number[];
  /** map of song ID to player index */
  winners: Record<string, number | null>;
  charts: Array<DrawnChart | PlayerPickPlaceholder>;
  bans: Record<string, PlayerActionOnChart | null>;
  protects: Record<string, PlayerActionOnChart | null>;
  pocketPicks: Record<string, PocketPick | null>;
  priorityPlayer?: number;
}

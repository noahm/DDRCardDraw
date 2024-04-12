import { DataConnection } from "peerjs";
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
  targetType: typeof CHART_PLACEHOLDER | typeof CHART_DRAWN;
}

export interface Drawing {
  id: string;
  title?: string;
  players: string[];
  charts: Array<DrawnChart | PlayerPickPlaceholder>;
  bans: Array<PlayerActionOnChart>;
  protects: Array<PlayerActionOnChart>;
  winners: Array<PlayerActionOnChart>;
  pocketPicks: Array<PocketPick>;
  priorityPlayer?: number;
  /** __ prefix avoids serializing this field during sync */
  __syncPeer?: DataConnection;
}

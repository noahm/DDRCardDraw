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
  drawGroup?: number;
  flags: string[];
  song: Song;
}

export interface DrawnChart extends EligibleChart {
  id: string;
}

export interface PlayerActionOnChart {
  player: number;
  chartId: string;
}

export interface PocketPick extends PlayerActionOnChart {
  pick: EligibleChart;
}

export interface Drawing {
  id: string;
  title?: string;
  players: string[];
  charts: DrawnChart[];
  bans: Array<PlayerActionOnChart>;
  protects: Array<PlayerActionOnChart>;
  winners: Array<PlayerActionOnChart>;
  pocketPicks: Array<PocketPick>;
  priorityPlayer?: number;
  /** __ prefix avoids serializing this field during sync */
  __syncPeer?: DataConnection;
}

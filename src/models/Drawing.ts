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
  hasShock: boolean;
  flags: string[];
  song: Song;
}

export interface DrawnChart extends EligibleChart {
  id: number;
}

export interface PlayerActionOnChart {
  player: 1 | 2;
  chartId: number;
}

export interface PocketPick extends PlayerActionOnChart {
  pick: EligibleChart;
}

export interface Drawing {
  id: string;
  title?: string;
  player1?: string;
  player2?: string;
  charts: DrawnChart[];
  bans: Array<PlayerActionOnChart>;
  protects: Array<PlayerActionOnChart>;
  pocketPicks: Array<PocketPick>;
  /** __ prefix avoids serializing this field during sync */
  __syncPeer?: DataConnection;
}

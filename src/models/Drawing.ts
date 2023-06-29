import { Song } from "./SongData";

export interface DrawnChart {
  name: string;
  jacket: string;
  nameTranslation?: string;
  artist: string;
  artistTranslation?: string;
  bpm: string;
  difficultyClass: string;
  level: number;
  flags: string[];
  song: Song;
  id?: number;
}

export interface PlayerActionOnChart {
  player: 1 | 2;
  chartId: number;
}

export interface PocketPick extends PlayerActionOnChart {
  pick: DrawnChart;
}

export interface Drawing {
  id: number;
  charts: DrawnChart[];
  bans: Array<PlayerActionOnChart>;
  protects: Array<PlayerActionOnChart>;
  pocketPicks: Array<PocketPick>;
}

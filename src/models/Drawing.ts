export interface DrawnChart {
  name: string;
  jacket: string;
  nameTranslation?: string;
  artist: string;
  artistTranslation?: string;
  bpm: string;
  difficultyClass: string;
  level: number;
  hasShock: boolean;
}

export interface PlayerActionOnChart {
  player: 1 | 2;
  chartIndex: number;
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

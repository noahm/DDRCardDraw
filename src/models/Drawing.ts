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

export interface Drawing {
  id: string;
  startggSetId: string;
  title: string;
  players: string[];
  charts: Array<DrawnChart | PlayerPickPlaceholder>;
  bans: Record<string, PlayerActionOnChart | null>;
  protects: Record<string, PlayerActionOnChart | null>;
  winners: Record<string, number | null>;
  pocketPicks: Record<string, PocketPick | null>;
  priorityPlayer?: number;
}

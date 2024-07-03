import { atom } from "jotai";

export const showEligibleCharts = atom(false);
export const showPlayerAndRoundLabels = atom(false);

export interface ConfigState {
  chartCount: number;
  playerPicks: number;
  upperBound: number;
  lowerBound: number;
  useWeights: boolean;
  orderByAction: boolean;
  hideVetos: boolean;
  weights: Array<number | undefined>;
  probabilityBucketCount: number | null;
  forceDistribution: boolean;
  constrainPocketPicks: boolean;
  style: string;
  folders: ReadonlySet<string>;
  difficulties: ReadonlySet<string>;
  flags: ReadonlySet<string>;
  cutoffDate: string;
  playerNames: string[];
  tournamentRounds: string[];
  defaultPlayersPerDraw: number;
  sortByLevel: boolean;
  useGranularLevels: boolean;
}

export const initialState: ConfigState = {
  chartCount: 5,
  playerPicks: 0,
  upperBound: 0,
  lowerBound: 0,
  useWeights: false,
  hideVetos: false,
  orderByAction: true,
  weights: [],
  probabilityBucketCount: null,
  forceDistribution: true,
  constrainPocketPicks: true,
  style: "",
  cutoffDate: "",
  folders: new Set(),
  difficulties: new Set(),
  flags: new Set(),
  playerNames: [],
  tournamentRounds: [
    "Pools",
    "Winner's Bracket",
    "Winner's Finals",
    "Loser's Bracket",
    "Loser's Finals",
    "Grand Finals",
    "Tiebreaker",
  ],
  sortByLevel: false,
  defaultPlayersPerDraw: 2,
  useGranularLevels: false,
};

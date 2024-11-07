import type { StoreApi } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";

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
  showEligibleCharts: boolean;
  playerNames: string[];
  tournamentRounds: string[];
  showPlayerAndRoundLabels: boolean;
  defaultPlayersPerDraw: number;
  sortByLevel: boolean;
  useGranularLevels: boolean;
  update: StoreApi<ConfigState>["setState"];
}

export const useConfigState = createWithEqualityFn<ConfigState>(
  (set) => ({
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
    showEligibleCharts: false,
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
    showPlayerAndRoundLabels: false,
    sortByLevel: false,
    defaultPlayersPerDraw: 2,
    useGranularLevels: false,
    update: set,
  }),
  Object.is,
);

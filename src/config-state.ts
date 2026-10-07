import type { StoreApi } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import type { BucketMode, ManualBucket } from "./draw-buckets";

export interface ConfigState {
  chartCount: number;
  playerPicks: number;
  /** ignored while `bucketMode` is "manual" */
  upperBound: number;
  /** ignored while `bucketMode` is "manual" */
  lowerBound: number;
  bucketMode: BucketMode;
  orderByAction: boolean;
  hideVetos: boolean;
  /** "auto" mode only, indexed positionally against the derived bucket layout */
  weights: Array<number | undefined>;
  /** "auto" mode only. null means one bucket per whole lvl */
  probabilityBucketCount: number | null;
  /** "manual" mode only */
  manualBuckets: Array<ManualBucket>;
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
  showMaxScore: boolean;
  update: StoreApi<ConfigState>["setState"];
}

export const useConfigState = createWithEqualityFn<ConfigState>(
  (set) => ({
    chartCount: 5,
    playerPicks: 0,
    upperBound: 0,
    lowerBound: 0,
    bucketMode: "none",
    hideVetos: false,
    orderByAction: true,
    weights: [],
    probabilityBucketCount: null,
    manualBuckets: [],
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
    showMaxScore: false,
    update: set,
  }),
  Object.is,
);

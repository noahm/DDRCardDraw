import {
  createSlice,
  createEntityAdapter,
  type PayloadAction,
  type Update,
} from "@reduxjs/toolkit";

export interface ConfigState {
  id: string;
  name: string;
  gameKey: string;
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
  folders: Array<string>;
  difficulties: Array<string>;
  flags: Array<string>;
  cutoffDate: string;
  defaultPlayersPerDraw: number;
  sortByLevel: boolean;
  useGranularLevels: boolean;
  /** when true, charts are not repeated between draws until all eligible charts have been seen */
  noDuplicates: boolean;
  /** chart keys already drawn from the deck (used when noDuplicates is enabled) */
  usedCharts: Array<string>;
  /** if present, will draw an additional set of cards for each string id in `configs` */
  multiDraws?: {
    /** if true, auto-merge the resulting draws */
    merge: boolean;
    /** ids of other configs to use for the subsequent draws */
    configs: Array<string>;
  };
}

export const defaultConfig: Omit<ConfigState, "id" | "name" | "gameKey"> = {
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
  folders: [],
  difficulties: [],
  flags: [],
  sortByLevel: false,
  defaultPlayersPerDraw: 2,
  useGranularLevels: false,
  noDuplicates: false,
  usedCharts: [],
};

const adapter = createEntityAdapter<ConfigState>({});

/** Config fields that affect which charts are eligible for drawing */
const ELIGIBILITY_FIELDS = new Set([
  "gameKey",
  "style",
  "difficulties",
  "lowerBound",
  "upperBound",
  "useGranularLevels",
  "folders",
  "flags",
  "useWeights",
  "weights",
  "probabilityBucketCount",
  "cutoffDate",
]);

export const configSlice = createSlice({
  name: "config",
  initialState: adapter.getInitialState(),
  reducers: {
    addOne: adapter.addOne,
    updateOne(state, action: PayloadAction<Update<ConfigState, string>>) {
      const { changes } = action.payload;
      // Auto-clear usedCharts when eligibility-affecting fields change
      if (
        !("usedCharts" in changes) &&
        Object.keys(changes).some((k) => ELIGIBILITY_FIELDS.has(k))
      ) {
        action.payload = {
          ...action.payload,
          changes: { ...changes, usedCharts: [] },
        };
      }
      adapter.updateOne(state, action);
    },
    removeOne: adapter.removeOne,
  },
  selectors: {
    ...adapter.getSelectors(),
  },
});

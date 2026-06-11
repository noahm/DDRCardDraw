import { createSlice, createEntityAdapter } from "@reduxjs/toolkit";

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
  showMaxScore: boolean;
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
  showMaxScore: false,
};

const adapter = createEntityAdapter<ConfigState>({});

export const configSlice = createSlice({
  name: "config",
  initialState: adapter.getInitialState(),
  reducers: {
    // oxlint-disable typescript/unbound-method
    addOne: adapter.addOne,
    updateOne: adapter.updateOne,
    removeOne: adapter.removeOne,
    /** insert or fully replace configs, keyed by id */
    setMany: adapter.setMany,
    // oxlint-enable typescript/unbound-method
  },
  selectors: {
    ...adapter.getSelectors(),
  },
});

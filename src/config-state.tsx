import createStore, { SetState } from "zustand";

export interface ConfigState {
  chartCount: number;
  upperBound: number;
  lowerBound: number;
  useWeights: boolean;
  orderByAction: boolean;
  weights: number[];
  /** charts of this level or higher will be grouped into the same "bucket" */
  groupSongsAt: number | null;
  forceDistribution: boolean;
  constrainPocketPicks: boolean;
  style: string;
  difficulties: ReadonlySet<string>;
  flags: ReadonlySet<string>;
  showPool: boolean;
  update: SetState<ConfigState>;
}

export const useConfigState = createStore<ConfigState>((set, get) => ({
  chartCount: 5,
  upperBound: 0,
  lowerBound: 0,
  useWeights: false,
  orderByAction: true,
  weights: [],
  groupSongsAt: null,
  forceDistribution: true,
  constrainPocketPicks: true,
  style: "",
  difficulties: new Set(),
  flags: new Set(),
  showPool: false,
  update: set,
}));

import createStore, { StoreApi } from "zustand";

export interface ConfigState {
  chartCount: number;
  upperBound: number;
  lowerBound: number;
  useWeights: boolean;
  orderByAction: boolean;
  showVeto: boolean;
  weights: number[];
  forceDistribution: boolean;
  style: string;
  difficulties: ReadonlySet<string>;
  flags: ReadonlySet<string>;
  showPool: boolean;
  update: StoreApi<ConfigState>["setState"];
}

export const useConfigState = createStore<ConfigState>((set, get) => ({
  chartCount: 5,
  upperBound: 0,
  lowerBound: 0,
  useWeights: false,
  showVeto: true,
  orderByAction: true,
  weights: [],
  forceDistribution: true,
  style: "",
  difficulties: new Set(),
  flags: new Set(),
  showPool: false,
  update: set,
}));

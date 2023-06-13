import createStore, { SetState } from "zustand";

export interface ConfigState {
  chartCount: number;
  upperBound: number;
  lowerBound: number;
  drawGroups: string[];
  useWeights: boolean;
  useDrawGroups: boolean;
  orderByAction: boolean;
  weights: number[];
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
  drawGroups: [],
  useWeights: false,
  useDrawGroups: false,
  orderByAction: true,
  weights: [],
  forceDistribution: true,
  constrainPocketPicks: true,
  style: "",
  difficulties: new Set(),
  flags: new Set(),
  showPool: false,
  update: set,
}));

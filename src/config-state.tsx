import createStore, { SetState } from "zustand";

export interface ConfigState {
  chartCount: number;
  upperBound: number;
  lowerBound: number;
  useWeights: boolean;
  orderByAction: boolean;
  /** sparse array: index is the difficulty level, value at index is the weight applied */
  weightsPerLevel: number[];
  /** keys are difficulty IDs, numbers are the limit for how many can be drawn */
  limitsPerDifficulty: ReadonlyMap<string, number>;
  forceDistribution: boolean;
  constrainPocketPicks: boolean;
  style: string;
  difficulties: ReadonlySet<string>;
  flags: ReadonlySet<string>;
  showPool: boolean;
  sortByLvl: boolean;
  sortByDifficulty: boolean;
  update: SetState<ConfigState>;
}

export const useConfigState = createStore<ConfigState>((set) => ({
  chartCount: 5,
  upperBound: 0,
  lowerBound: 0,
  useWeights: false,
  orderByAction: true,
  weightsPerLevel: [],
  limitsPerDifficulty: new Map(),
  forceDistribution: true,
  constrainPocketPicks: true,
  style: "",
  difficulties: new Set(),
  flags: new Set(),
  showPool: false,
  sortByLvl: false,
  sortByDifficulty: false,
  update: set,
}));

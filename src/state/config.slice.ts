import { createSlice, createEntityAdapter, type Slice } from "@reduxjs/toolkit";
import type { BucketMode, ManualBucket } from "../draw-buckets";

export interface ConfigState {
  id: string;
  name: string;
  gameKey: string;
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

type StateOfSlice<S> = S extends Slice<infer State> ? State : never;

/** fields a config carried before difficulty buckets replaced the toggle */
interface LegacyBucketFields {
  /** replaced by `bucketMode` */
  useWeights?: boolean;
}

/**
 * Brings one config up to the bucket fields. Configs persist, and a saved one
 * has no `bucketMode` at all — which reads as neither "none", "auto" nor
 * "manual", so the draw ends up with no buckets and throws rather than
 * degrading.
 */
export function migrateConfigToBuckets<T extends ConfigState>(config: T): T {
  const legacy = config as T & LegacyBucketFields;
  if (config.bucketMode === undefined) {
    config.bucketMode = legacy.useWeights ? "auto" : "none";
  }
  delete legacy.useWeights;
  if (!config.manualBuckets) {
    config.manualBuckets = [];
  }
  return config;
}

/** mutates every stored config to have the bucket fields */
export function migrateConfigsToBuckets(
  state: StateOfSlice<typeof configSlice>,
) {
  for (const id of state.ids) {
    const config = state.entities[id];
    if (config) migrateConfigToBuckets(config);
  }
}

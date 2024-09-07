import {
  createSlice,
  createEntityAdapter,
  PayloadAction,
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
};

const adapter = createEntityAdapter<ConfigState>({});

export const configSlice = createSlice({
  name: "config",
  initialState: {
    ...adapter.getInitialState(),
    current: null as string | null,
  },
  reducers: {
    pickCurrent(state, action: PayloadAction<string | null>) {
      state.current = action.payload;
    },
    addOne: (state, action: PayloadAction<ConfigState>) => {
      const nextState = adapter.addOne(state, action);
      nextState.current = action.payload.id;
    },
    updateOne: adapter.updateOne,
    removeOne: (state, action: PayloadAction<string>) => {
      const nextState = adapter.removeOne(state, action);
      if (nextState.current === action.payload) {
        nextState.current = nextState.ids.length ? nextState.ids[0] : null;
      }
    },
  },
  selectors: {
    ...adapter.getSelectors(),
    getCurrent(state) {
      if (state.current) {
        return state.entities[state.current];
      }
      return null;
    },
  },
});

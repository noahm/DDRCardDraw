import {
  createSlice,
  createEntityAdapter,
  PayloadAction,
} from "@reduxjs/toolkit";
import { GameData } from "../models/SongData";
import { nanoid } from "nanoid";

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
    addOne: adapter.addOne,
    updateOne: adapter.updateOne,
    removeOne: adapter.removeOne,
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

function getOverridesFromGameData(gameData: GameData) {
  const {
    flags,
    difficulties,
    folders,
    style,
    lowerLvlBound: lowerBound,
    upperLvlBound: upperBound,
  } = gameData.defaults;
  const gameSpecificOverrides: Partial<ConfigState> = {
    lowerBound,
    upperBound,
    flags,
    difficulties,
    style,
    cutoffDate: "",
  };
  if (folders) {
    gameSpecificOverrides.folders = folders;
  }
  if (!gameData.meta.granularTierResolution) {
    gameSpecificOverrides.useGranularLevels = false;
  }
  return gameSpecificOverrides;
}

export function createFromGameData(
  gameData: GameData,
  name: string,
  gameKey: string,
) {
  const newConfig: ConfigState = {
    id: nanoid(10),
    name,
    gameKey,
    ...defaultConfig,
    ...getOverridesFromGameData(gameData),
  };
  return configSlice.actions.addOne(newConfig);
}

import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { GameData } from "../models/SongData";
import { loadGameDataByName } from "./thunks";

interface GameDataState {
  gameData: GameData | null;
  dataSetName: string;
  uploadCache: Record<string, GameData>;
}

const initialState: GameDataState = {
  gameData: null,
  dataSetName: "",
  uploadCache: {},
};

export const gameDataSlice = createSlice({
  name: "gameData",
  initialState,
  reducers: {
    selectCustomData(
      state,
      action: PayloadAction<{ name: string; gameData: GameData }>,
    ) {
      state.dataSetName = action.payload.name;
      state.gameData = action.payload.gameData;
      if (state.uploadCache[action.payload.name] !== action.payload.gameData) {
        state.uploadCache[action.payload.name] = action.payload.gameData;
      }
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadGameDataByName.fulfilled, (state, action) => {
        state.gameData = action.payload;
      })
      .addCase(loadGameDataByName.pending, (state, action) => {
        state.dataSetName = action.meta.arg;
        state.gameData = null;
      });
  },
});

export const { actions } = gameDataSlice;

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ConfigState, initialState } from "../config-state";
import { loadGameDataByName } from "./thunks";
import { GameData } from "../models/SongData";
import { gameDataSlice } from "./game-data.slice";
import { addPlayerNameToDrawing } from "./central";

function createPartialFromDefaults(gameData: GameData) {
  const { lowerLvlBound, upperLvlBound, flags, difficulties, folders, style } =
    gameData.defaults;
  const ret: Partial<ConfigState> = {
    lowerBound: lowerLvlBound,
    upperBound: upperLvlBound,
    flags,
    difficulties,
    folders,
    style,
    cutoffDate: "",
  };
  if (!gameData.meta.granularTierResolution) {
    ret.useGranularLevels = false;
  }
  return ret;
}

export const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    update: (state, action: PayloadAction<Partial<ConfigState>>) => {
      Object.assign(state, action.payload);
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadGameDataByName.fulfilled, (state, action) => {
        const patch = createPartialFromDefaults(action.payload);
        Object.assign(state, patch);
      })
      .addCase(gameDataSlice.actions.selectCustomData, (state, action) => {
        const patch = createPartialFromDefaults(action.payload.gameData);
        Object.assign(state, patch);
      })
      .addCase(addPlayerNameToDrawing, (state, action) => {
        if (!action.payload.name) {
          return;
        }
        if (state.playerNames.includes(action.payload.name)) {
          return;
        }
        state.playerNames.push(action.payload.name);
      });
  },
});

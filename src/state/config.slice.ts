import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ConfigState, initialState } from "../config-state";
import { GameData } from "../models/SongData";
import { addPlayerNameToDrawing } from "./central";

export const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    update(state, action: PayloadAction<Partial<ConfigState>>) {
      Object.assign(state, action.payload);
    },
    applyDefaults(
      state,
      action: PayloadAction<
        GameData["defaults"] & { supportsGranular: boolean }
      >,
    ) {
      const { flags, difficulties, folders, style } = action.payload;
      const patch: Partial<ConfigState> = {
        lowerBound: action.payload.lowerLvlBound,
        upperBound: action.payload.upperLvlBound,
        flags,
        difficulties,
        folders,
        style,
        cutoffDate: "",
      };
      if (!action.payload.supportsGranular) {
        patch.useGranularLevels = false;
      }
      Object.assign(state, patch);
    },
  },
  extraReducers(builder) {
    builder.addCase(addPlayerNameToDrawing, (state, action) => {
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

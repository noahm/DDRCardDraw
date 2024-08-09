import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ConfigState, initialState } from "../config-state";
import { GameData } from "../models/SongData";

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
        style,
        cutoffDate: "",
      };
      if (folders) {
        patch.folders = folders;
      }
      if (!action.payload.supportsGranular) {
        patch.useGranularLevels = false;
      }
      Object.assign(state, patch);
    },
  },
});

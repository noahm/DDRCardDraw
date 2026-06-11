import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { GameData } from "../models/SongData";

export type CustomGameDataState = Record<string, GameData>;

export const customGameDataSlice = createSlice({
  name: "customGameData",
  initialState: {} as CustomGameDataState,
  reducers: {
    add(state, action: PayloadAction<{ name: string; data: GameData }>) {
      state[action.payload.name] = action.payload.data;
    },
    remove(state, action: PayloadAction<string>) {
      delete state[action.payload];
    },
  },
});

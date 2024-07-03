import { createAsyncThunk } from "@reduxjs/toolkit";
import { GameData } from "../models/SongData";
import { AppState, AppDispatch } from "./store";

const createTypedThunk = createAsyncThunk.withTypes<{
  state: AppState;
  dispatch: AppDispatch;
}>();

export const loadGameDataByName = createTypedThunk(
  "gameData/load",
  async (name: string) => {
    return (
      await import(/* webpackChunkName: "songData" */ `./songs/${name}.json`)
    ).default as GameData;
  },
  {
    condition(arg, api) {
      const state = api.getState();
      if (arg === state.gameData.dataSetName) {
        return false;
      }
    },
  },
);

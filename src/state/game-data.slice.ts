import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { GameData, Song } from "../models/SongData";
import FuzzySearch from "fuzzy-search";
import { loadGameDataByName } from "./thunks";

interface GameDataState {
  gameData: GameData | null;
  dataSetName: string;
  fuzzySearch: FuzzySearch<Song> | null;
}

const initialState: GameDataState = {
  gameData: null,
  dataSetName: "",
  fuzzySearch: null,
};

function createFuzzySearch(gameData: GameData) {
  return new FuzzySearch(
    gameData.songs,
    ["name", "name_translation", "search_hint", "artist", "artist_translation"],
    {
      sort: true,
    },
  );
}

export const gameDataSlice = createSlice({
  name: "gameData",
  initialState,
  reducers: {
    uploadGameData(
      state,
      action: PayloadAction<{ name: string; gameData: GameData }>,
    ) {
      state.dataSetName = action.payload.name;
      state.gameData = action.payload.gameData;
      state.fuzzySearch = createFuzzySearch(action.payload.gameData);
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadGameDataByName.fulfilled, (state, action) => {
        state.gameData = action.payload;
        state.fuzzySearch = createFuzzySearch(action.payload);
      })
      .addCase(loadGameDataByName.pending, (state, action) => {
        state.dataSetName = action.meta.arg;
        state.gameData = null;
        state.fuzzySearch = null;
      });
  },
});

export const { actions } = gameDataSlice;

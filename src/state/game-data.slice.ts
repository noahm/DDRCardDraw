import { PayloadAction, createSlice } from "@reduxjs/toolkit";

interface GameDataState {
  dataSetName: string;
  dataType: "stock" | "custom";
}

const initialState: GameDataState = {
  dataSetName: "",
  dataType: "stock",
};

export const gameDataSlice = createSlice({
  name: "gameData",
  initialState,
  reducers: {
    selectGameData(state, action: PayloadAction<GameDataState>) {
      return action.payload;
    },
  },
});

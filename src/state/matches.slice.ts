import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

export interface TournamentSet {
  id: string;
  roundText: string;
  playerIds: string[];
}

const setsAdapter = createEntityAdapter<TournamentSet>();
const selectors = setsAdapter.getSelectors();

export const setsSlice = createSlice({
  name: "sets",
  initialState: setsAdapter.getInitialState(),
  reducers: {
    removeMany: setsAdapter.removeMany,
    upsertMany: setsAdapter.upsertMany,
    upsertOne: setsAdapter.updateOne,
  },
  selectors: {
    selectAll: selectors.selectAll,
    selectById: selectors.selectById,
    selectIds: selectors.selectIds,
  },
});

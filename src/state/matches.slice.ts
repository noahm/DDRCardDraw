import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

interface SetPlayer {
  type: "player";
  playerId: string;
}

interface SetPrereq {
  type: "setprereq";
  setId: string;
}

export type Slot = SetPlayer | SetPrereq;

export interface TournamentSet {
  id: string;
  roundText: string;
  slots: Slot[];
  winningPlayerId?: string;
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

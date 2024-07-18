import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

export interface Entrant {
  id: string;
  ingameName?: string;
  startggTag: string;
}

const entrantsAdapter = createEntityAdapter<Entrant>();
const selectors = entrantsAdapter.getSelectors();

export const entrantsSlice = createSlice({
  name: "entrants",
  initialState: entrantsAdapter.getInitialState(),
  reducers: {
    removeMany: entrantsAdapter.removeMany,
    upsertMany: entrantsAdapter.upsertMany,
    upsertOne: entrantsAdapter.updateOne,
  },
  selectors: {
    selectAll: selectors.selectAll,
    selectById: selectors.selectById,
    selectIds: selectors.selectIds,
  },
});

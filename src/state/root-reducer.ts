import { combineSlices } from "@reduxjs/toolkit";
import { configSlice } from "./config.slice";
import { drawingsSlice } from "./drawings.slice";
import { receivePartyState } from "./central";
import { eventSlice } from "./event.slice";
import { drawingGroupsSlice } from "./drawing-groups.slice";

const combinedReducer = combineSlices(
  drawingsSlice,
  configSlice,
  eventSlice,
  drawingGroupsSlice,
);

export type AppState = ReturnType<typeof combinedReducer>;

export const reducer: typeof combinedReducer = (state, action) => {
  if (receivePartyState.match(action)) {
    return Object.assign({}, state, action.payload);
  }
  return combinedReducer(state, action);
};

reducer.inject = combinedReducer.inject;
reducer.withLazyLoadedSlices = combinedReducer.withLazyLoadedSlices;
reducer.selector = combinedReducer.selector;

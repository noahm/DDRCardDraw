// oxlint-disable typescript/unbound-method
import { combineSlices } from "@reduxjs/toolkit";
import { configSlice } from "./config.slice";
import { drawingsSlice } from "./drawings.slice";
import { receiveRoomState } from "./central";
import { eventSlice } from "./event.slice";
import { customGameDataSlice } from "./custom-game-data.slice";

const combinedReducer = combineSlices(
  drawingsSlice,
  configSlice,
  eventSlice,
  customGameDataSlice,
);

export type AppState = ReturnType<typeof combinedReducer>;

export const reducer: typeof combinedReducer = (state, action) => {
  if (receiveRoomState.match(action)) {
    return Object.assign({}, state, action.payload);
  }
  return combinedReducer(state, action);
};

reducer.inject = combinedReducer.inject;
reducer.withLazyLoadedSlices = combinedReducer.withLazyLoadedSlices;
reducer.selector = combinedReducer.selector;

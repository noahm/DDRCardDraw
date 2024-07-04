import { combineSlices } from "@reduxjs/toolkit";
import { configSlice } from "./config.slice";
import { drawingsSlice } from "./drawings.slice";
import { gameDataSlice } from "./game-data.slice";
import { receivePartyState } from "./central";

const combinedReducer = combineSlices(
  drawingsSlice,
  configSlice,
  gameDataSlice,
);

export const reducer: typeof combinedReducer = (state, action) => {
  if (receivePartyState.match(action)) {
    return action.payload;
  }
  return combinedReducer(state, action);
};

reducer.inject = combinedReducer.inject;
reducer.withLazyLoadedSlices = combinedReducer.withLazyLoadedSlices;
reducer.selector = combinedReducer.selector;

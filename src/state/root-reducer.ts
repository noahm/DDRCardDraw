import { combineSlices } from "@reduxjs/toolkit";
import { configSlice } from "./config.slice";
import { drawingsSlice } from "./drawings.slice";
import { receivePartyState } from "./central";
import { eventSlice } from "./event.slice";

const combinedReducer = combineSlices(drawingsSlice, configSlice, eventSlice);

export const reducer: typeof combinedReducer = (state, action) => {
  if (receivePartyState.match(action)) {
    return Object.assign({}, state, action.payload);
  }
  return combinedReducer(state, action);
};

reducer.inject = combinedReducer.inject;
reducer.withLazyLoadedSlices = combinedReducer.withLazyLoadedSlices;
reducer.selector = combinedReducer.selector;
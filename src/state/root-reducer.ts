// oxlint-disable typescript/unbound-method
import { combineSlices } from "@reduxjs/toolkit";
import { configSlice } from "./config.slice";
import { drawingsSlice } from "./drawings.slice";
import { receivePartyState } from "./central";
import { eventSlice } from "./event.slice";
import {
  assertNoNewChartReuse,
  couldViolateReuseRule,
} from "./reuse-invariant";

const combinedReducer = combineSlices(drawingsSlice, configSlice, eventSlice);

export type AppState = ReturnType<typeof combinedReducer>;

export const reducer: typeof combinedReducer = (state, action) => {
  if (receivePartyState.match(action)) {
    return Object.assign({}, state, action.payload);
  }
  const next = combinedReducer(state, action);
  // Invariants live here rather than in a slice reducer because they need to
  // see the whole state, and because this bundle is what the party server runs:
  // a throw is how the server refuses an action, rolling the sender back
  // instead of letting the room diverge. See `reuse-invariant.ts`.
  if (state && couldViolateReuseRule(action.type)) {
    assertNoNewChartReuse(state, next);
  }
  return next;
};

reducer.inject = combinedReducer.inject;
reducer.withLazyLoadedSlices = combinedReducer.withLazyLoadedSlices;
reducer.selector = combinedReducer.selector;

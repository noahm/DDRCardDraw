import { createAction } from "@reduxjs/toolkit";
import { withPayload } from "./util";
import type { AppState } from "./store";

export const receivePartyState = createAction(
  "party/supplyState",
  withPayload<AppState>(),
);

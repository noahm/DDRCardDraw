import { createAction } from "@reduxjs/toolkit";
import { withPayload } from "./util";
import type { AppState } from "./store";

export const receivePartyState = createAction(
  "party/supplyState",
  withPayload<AppState>(),
);

export const addPlayerNameToDrawing = createAction(
  "players/addToDrawing",
  withPayload<{ name: string; asPlayerNo: number; drawingId: string }>(),
);

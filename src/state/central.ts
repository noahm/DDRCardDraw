import { createAction } from "@reduxjs/toolkit";
import { withPayload } from "./util";
import { Roomstate } from "../party/types";

export const receivePartyState = createAction(
  "party/supplyState",
  withPayload<Roomstate>(),
);

export const addPlayerNameToDrawing = createAction(
  "players/addToDrawing",
  withPayload<{ name: string; asPlayerNo: number; drawingId: string }>(),
);

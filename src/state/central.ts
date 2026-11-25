import { createAction } from "@reduxjs/toolkit";
import { withPayload } from "./util";
import type { AppState } from "./store";
import type { SubDrawing } from "../models/Drawing";
import { nanoid } from "nanoid";

export const receivePartyState = createAction(
  "party/supplyState",
  withPayload<AppState>(),
);

export const mergeDraws = createAction(
  "drawings/mergeSubdraws",
  (input: { drawingId: string; charts?: SubDrawing["charts"] }) => {
    return {
      payload: {
        drawingId: input.drawingId,
        newSubdrawId: `set-${nanoid(12)}`,
        /**
         * The merged set in its final order, decided by the client that asked
         * for the merge (see `mergeSubdraws` in `thunks.ts`). Sorting can't
         * happen in the reducer: a shuffle would land differently on every
         * replica of a room, and the sort a config asks for isn't reachable
         * from the drawings slice anyway. Absent from an older client's
         * action, which the reducer falls back to plain concatenation for.
         */
        charts: input.charts,
      },
    };
  },
);

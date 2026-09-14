import { createAction } from "@reduxjs/toolkit";
import { withPayload } from "./util";
import type { AppState } from "./store";
import { nanoid } from "nanoid";

export const receivePartyState = createAction(
  "party/supplyState",
  withPayload<AppState>(),
);

export const mergeDraws = createAction(
  "drawings/mergeSubdraws",
  (input: { drawingId: string }) => {
    return {
      payload: {
        drawingId: input.drawingId,
        newSubdrawId: `set-${nanoid(12)}`,
      },
    };
  },
);

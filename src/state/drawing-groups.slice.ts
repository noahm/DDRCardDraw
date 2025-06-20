import {
  PayloadAction,
  createEntityAdapter,
  createSlice,
} from "@reduxjs/toolkit";
import { DrawingGroup } from "../models/Drawing";

type ActionWithStringPayload = PayloadAction<string>;

export const drawingGroupsAdapter = createEntityAdapter<DrawingGroup>({});

export const drawingGroupsSlice = createSlice({
  name: "drawingGroups",
  initialState: drawingGroupsAdapter.getInitialState(),
  reducers: {
    addDrawingGroup: drawingGroupsAdapter.addOne,
    updateOne: drawingGroupsAdapter.updateOne,
    removeOne: drawingGroupsAdapter.removeOne,
    clearDrawingGroups: drawingGroupsAdapter.removeAll,
    swapPlayerPositions(state, action: ActionWithStringPayload) {
      const drawing = state.entities[action.payload];
      if (!drawing) {
        return;
      }
      drawing.playerDisplayOrder = drawing.playerDisplayOrder.toReversed();
    },
    incrementPriorityPlayer(state, action: ActionWithStringPayload) {
      const drawing = state.entities[action.payload];
      if (!drawing) {
        return;
      }
      let priorityPlayer = drawing.priorityPlayer;
      if (!priorityPlayer) {
        priorityPlayer = 1;
      } else {
        priorityPlayer += 1;
        if (priorityPlayer >= drawing.playerDisplayOrder.length + 1) {
          priorityPlayer = undefined;
        }
      }
      drawing.priorityPlayer = priorityPlayer;
    },
    addPlayerScore(
      state,
      action: PayloadAction<{
        drawingId: string;
        chartId: string;
        playerId: string;
        score: number;
      }>,
    ) {
      const { drawingId, playerId, chartId, score } = action.payload;
      const drawing = state.entities[drawingId];
      if (!drawing) {
        return;
      }
      if (drawing.meta.type !== "startgg") {
        return;
      }
      if (!drawing.meta.scoresByEntrant) {
        drawing.meta.scoresByEntrant = {};
        for (const entrant of drawing.meta.entrants) {
          drawing.meta.scoresByEntrant[entrant.id] = {};
        }
      }
      drawing.meta.scoresByEntrant[playerId][chartId] = score;
    },
  },
  selectors: {
    haveSets(state) {
      return !!state.ids.length;
    },
  },
});

export const drawingGroupsSelectors = drawingGroupsAdapter.getSelectors(
  drawingGroupsSlice.selectSlice,
);

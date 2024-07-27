import {
  PayloadAction,
  createEntityAdapter,
  createSlice,
} from "@reduxjs/toolkit";
import {
  Drawing,
  DrawnChart,
  EligibleChart,
  PlayerActionOnChart,
} from "../models/Drawing";
import { addPlayerNameToDrawing } from "./central";
import { AppState } from "./store";
import { draw } from "../card-draw";
import { getDefaultStore } from "jotai";
import { gameDataAtom } from "./game-data.atoms";

export const drawingsAdapter = createEntityAdapter<Drawing>({});

declare const umami: {
  track(
    eventName?: string,
    eventProperties?: Record<string, string | number | undefined>,
  ): void;
};

function trackDraw(count: number | null, game?: string) {
  if (typeof umami === "undefined") {
    return;
  }
  const results =
    count === null ? { result: "failed" } : { result: "success", count, game };
  umami.track("cards-drawn", results);
}

/**
 * Performs a draw and returns an action to be dispatched
 * @returns false if no draw was possible, and
 * true if fewer charts were drawn than requested,
 * addDrawing action in the default successful case
 */
export function createDraw(state: AppState) {
  const jotaiStore = getDefaultStore();
  const gameData = jotaiStore.get(gameDataAtom);
  if (!gameData) {
    trackDraw(null);
    return false;
  }

  const drawing = draw(gameData, state.config);
  trackDraw(drawing.charts.length, state.gameData.dataSetName);
  if (!drawing.charts.length) {
    return true;
  }

  return drawingsSlice.actions.addDrawing(drawing);
}

/** payload is the drawing id */
type ActionOnSingleDrawing = PayloadAction<string>;
// eslint-disable-next-line @typescript-eslint/ban-types
type ActionOnSingleChart<extra extends object = {}> = PayloadAction<
  { drawingId: string; chartId: string } & extra
>;
// eslint-disable-next-line @typescript-eslint/ban-types
type PlayerActionOnChartPayload<extra extends object = {}> = PayloadAction<
  {
    drawingId: string;
    chartId: string;
    player: number;
    reorder: boolean;
  } & extra
>;

export const drawingsSlice = createSlice({
  name: "drawings",
  initialState: drawingsAdapter.getInitialState(),
  reducers: {
    addDrawing: drawingsAdapter.addOne,
    updateOne: drawingsAdapter.updateOne,
    clearDrawings: drawingsAdapter.removeAll,
    updateOneChart(
      state,
      action: PayloadAction<{
        drawingId: string;
        chartId: string;
        changes: Partial<DrawnChart>;
      }>,
    ) {
      const chart = state.entities[action.payload.drawingId].charts.find(
        (c) => c.id === action.payload.chartId,
      );
      if (!chart) {
        return;
      }
      Object.assign(chart, action.payload.changes);
    },
    addEmptyPlayer(state, action: ActionOnSingleDrawing) {
      const drawing = state.entities[action.payload];
      if (!drawing) return;
      drawing.players.push("");
    },
    dropPlayer(state, action: ActionOnSingleDrawing) {
      const drawing = state.entities[action.payload];
      if (!drawing) return;
      drawing.players.pop();
    },
    incrementPriorityPlayer(state, action: ActionOnSingleDrawing) {
      const drawing = state.entities[action.payload];
      if (!drawing) {
        return;
      }
      let priorityPlayer = drawing.priorityPlayer;
      if (!priorityPlayer) {
        priorityPlayer = 1;
      } else {
        priorityPlayer += 1;
        if (priorityPlayer >= drawing.players.length + 1) {
          priorityPlayer = undefined;
        }
      }
      drawing.priorityPlayer = priorityPlayer;
    },
    resetChart(state, action: ActionOnSingleChart) {
      const { chartId, drawingId } = action.payload;
      const drawing = state.entities[drawingId];
      if (!drawing) {
        return;
      }
      delete drawing.bans[chartId];
      delete drawing.protects[chartId];
      delete drawing.pocketPicks[chartId];
      delete drawing.winners[chartId];
    },
    banProtectReplace(
      state,
      action: PlayerActionOnChartPayload<
        { type: "ban" | "protect" } | { type: "pocket"; pick: EligibleChart }
      >,
    ) {
      const { chartId, drawingId, player, reorder } = action.payload;
      const drawing = state.entities[drawingId];
      if (!drawing) {
        return;
      }
      const playerAction: PlayerActionOnChart = { chartId, player };
      if (action.payload.type === "ban") {
        if (reorder) {
          moveChartInArray(drawing, chartId, "end");
        }
        drawing.bans[chartId] = playerAction;
      } else if (action.payload.type === "protect") {
        if (reorder) {
          moveChartInArray(drawing, chartId, "start");
        }
        drawing.protects[chartId] = playerAction;
      } else if (action.payload.type === "pocket") {
        if (reorder) {
          moveChartInArray(drawing, chartId, "start");
        }
        drawing.pocketPicks[chartId] = {
          chartId,
          player,
          pick: action.payload.pick,
        };
      }
    },
    setWinner(state, action: ActionOnSingleChart<{ player: number | null }>) {
      const winners = state.entities[action.payload.drawingId].winners;
      if (action.payload.player === null) {
        delete winners[action.payload.chartId];
      } else {
        winners[action.payload.chartId] = action.payload.player;
      }
    },
  },
  extraReducers(builder) {
    builder.addCase(addPlayerNameToDrawing, (state, action) => {
      const drawing = state.entities[action.payload.drawingId];
      if (!drawing) {
        return;
      }
      drawing.players[action.payload.asPlayerNo - 1] = action.payload.name;
    });
  },
  selectors: {
    haveDrawings(state) {
      return !!state.ids.length;
    },
  },
});

export const drawingSelectors = drawingsAdapter.getSelectors(
  drawingsSlice.selectSlice,
);

export function createRedrawAll(state: AppState, drawingId: string) {
  // TODO preserve protects and pocket picks in this logic
  const drawing = state.drawings.entities[drawingId];
  const drawConfig = {
    ...state.config,
    chartCount: drawing.charts.length,
  };
  const jotaiStore = getDefaultStore();
  const gameData = jotaiStore.get(gameDataAtom);
  const drawResult = draw(gameData!, drawConfig);
  return drawingsSlice.actions.updateOne({
    id: drawingId,
    changes: {
      charts: drawResult.charts,
      pocketPicks: {},
      bans: {},
      protects: {},
      winners: {},
    },
  });
}

export function createRedrawChart(
  state: AppState,
  drawingId: string,
  chartId: string,
) {
  const drawConfig = {
    ...state.config,
    chartCount: 1,
  };
  const jotaiStore = getDefaultStore();
  const gameData = jotaiStore.get(gameDataAtom);
  const drawResult = draw(gameData!, drawConfig);
  const chart = drawResult.charts.find((c) => c.type === "DRAWN");
  if (!chart) {
    return;
  }
  return drawingsSlice.actions.updateOneChart({
    drawingId,
    chartId,
    changes: chart,
  });
}

function moveChartInArray(
  drawing: Drawing,
  chartId: string,
  pos: "start" | "end",
) {
  const targetChart = drawing.charts.find((c) => c.id === chartId);
  if (!targetChart) {
    return;
  }
  const chartsWithoutTarget = drawing.charts.filter((c) => c.id !== chartId);
  if (pos === "start") {
    const insertIdx =
      Object.keys(drawing.protects).length +
      Object.keys(drawing.pocketPicks).length;
    chartsWithoutTarget.splice(insertIdx, 0, targetChart);
  } else {
    chartsWithoutTarget.push(targetChart);
  }
  drawing.charts = chartsWithoutTarget;
}

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

export const drawingsAdapter = createEntityAdapter<Drawing>({});

/** payload is the drawing id */
type ActionOnSingleDrawing = PayloadAction<string>;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type ActionOnSingleChart<extra extends object = {}> = PayloadAction<
  { drawingId: string; chartId: string } & extra
>;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
    removeOne: drawingsAdapter.removeOne,
    clearDrawings: drawingsAdapter.removeAll,
    addOneChart(
      state,
      action: PayloadAction<{
        drawingId: string;
        chart: DrawnChart;
      }>,
    ) {
      const drawing = state.entities[action.payload.drawingId];
      drawing.charts.push(action.payload.chart);
    },
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
    swapPlayerPositions(state, action: ActionOnSingleDrawing) {
      const drawing = state.entities[action.payload];
      if (!drawing) {
        return;
      }
      drawing.playerDisplayOrder = drawing.playerDisplayOrder.toReversed();
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
        if (priorityPlayer >= drawing.playerDisplayOrder.length + 1) {
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
    haveDrawings(state) {
      return !!state.ids.length;
    },
  },
});

export const drawingSelectors = drawingsAdapter.getSelectors(
  drawingsSlice.selectSlice,
);

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

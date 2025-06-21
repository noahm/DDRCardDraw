import {
  PayloadAction,
  Slice,
  createEntityAdapter,
  createSlice,
} from "@reduxjs/toolkit";
import {
  Drawing,
  DrawnChart,
  EligibleChart,
  PlayerActionOnChart,
  SubDrawing,
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
    removeOne(state, action: PayloadAction<string>) {
      const [mainId, subId] = splitCompoundId(action.payload);
      if (!subId) {
        return drawingsAdapter.removeOne(state, mainId);
      }
      const drawing = state.entities[mainId];
      if (drawing.subDrawings) {
        const target = drawing.subDrawings[subId];
        delete drawing.subDrawings[subId];
        for (const chart of target.charts) {
          delete drawing.winners[chart.id];
          delete drawing.pocketPicks[chart.id];
          delete drawing.bans[chart.id];
          delete drawing.protects[chart.id];
        }
      }
    },
    clearDrawings: drawingsAdapter.removeAll,
    addOneChart(
      state,
      action: PayloadAction<{
        drawingId: string;
        chart: DrawnChart;
      }>,
    ) {
      const [, target] = getDrawingFromCompoundId(
        state,
        action.payload.drawingId,
      );
      target.charts.push(action.payload.chart);
    },
    updateOneChart(
      state,
      action: PayloadAction<{
        drawingId: string;
        chartId: string;
        changes: Partial<DrawnChart>;
      }>,
    ) {
      const [, target] = getDrawingFromCompoundId(
        state,
        action.payload.drawingId,
      );
      const chart = target.charts.find((c) => c.id === action.payload.chartId);
      if (!chart) {
        return;
      }
      Object.assign(chart, action.payload.changes);
    },
    swapPlayerPositions(state, action: ActionOnSingleDrawing) {
      const [mainId] = splitCompoundId(action.payload);
      const drawing = state.entities[mainId];
      if (!drawing) {
        return;
      }
      drawing.playerDisplayOrder = drawing.playerDisplayOrder.toReversed();
    },
    incrementPriorityPlayer(state, action: ActionOnSingleDrawing) {
      const [mainId] = splitCompoundId(action.payload);
      const drawing = state.entities[mainId];
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
      const [drawing] = getDrawingFromCompoundId(state, drawingId);
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
      const [drawing, target] = getDrawingFromCompoundId(state, drawingId);
      if (!drawing) {
        return;
      }
      const playerAction: PlayerActionOnChart = { chartId, player };
      if (action.payload.type === "ban") {
        if (reorder) {
          target.charts = moveChartInArray(
            drawing,
            target.charts,
            chartId,
            "end",
          );
        }
        drawing.bans[chartId] = playerAction;
      } else if (action.payload.type === "protect") {
        if (reorder) {
          target.charts = moveChartInArray(
            drawing,
            target.charts,
            chartId,
            "start",
          );
        }
        drawing.protects[chartId] = playerAction;
      } else if (action.payload.type === "pocket") {
        if (reorder) {
          target.charts = moveChartInArray(
            drawing,
            target.charts,
            chartId,
            "start",
          );
        }
        drawing.pocketPicks[chartId] = {
          chartId,
          player,
          pick: action.payload.pick,
        };
      }
    },
    setWinner(state, action: ActionOnSingleChart<{ player: number | null }>) {
      const [drawing] = getDrawingFromCompoundId(
        state,
        action.payload.drawingId,
      );
      const winners = drawing.winners;
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
      const [mainId] = splitCompoundId(drawingId);
      const drawing = state.entities[mainId];
      if (!drawing) {
        return;
      }
      if (
        drawing.meta.type !== "startgg" ||
        drawing.meta.subtype !== "gauntlet"
      ) {
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
    addSubdraw(
      state,
      action: PayloadAction<{ newSubdraw: SubDrawing; existingDrawId: string }>,
    ) {
      const { existingDrawId, newSubdraw } = action.payload;
      const [mainId] = splitCompoundId(existingDrawId);
      const existingDraw = state.entities[mainId];
      if (!existingDraw.subDrawings) {
        existingDraw.subDrawings = {};
      }
      existingDraw.subDrawings[newSubdraw.id] = newSubdraw;
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

type StateOfSlice<S> = S extends Slice<infer State> ? State : never;

/**
 * for convenience, sometimes a sub drawing is passed around with a synthetic id of:
 * `parentId:ownId` and this is used to break the parts down again.
 */
export function splitCompoundId(id: string) {
  return id.split(":") as [mainId: string, subId?: string];
}

export function getDrawingFromCompoundId(
  state: StateOfSlice<typeof drawingsSlice>,
  id: string,
): [parent: Drawing, target: Drawing | SubDrawing] {
  const [mainId, subId] = splitCompoundId(id);
  const drawing = state.entities[mainId];
  if (subId && drawing.subDrawings) {
    return [drawing, drawing.subDrawings[subId]];
  }
  return [drawing, drawing];
}

function moveChartInArray(
  drawing: Drawing,
  charts: Drawing["charts"],
  chartId: string,
  pos: "start" | "end",
) {
  const targetChart = charts.find((c) => c.id === chartId);
  if (!targetChart) {
    return charts;
  }
  const chartsWithoutTarget = charts.filter((c) => c.id !== chartId);
  if (pos === "start") {
    const insertIdx =
      Object.keys(drawing.protects).length +
      Object.keys(drawing.pocketPicks).length;
    chartsWithoutTarget.splice(insertIdx, 0, targetChart);
  } else {
    chartsWithoutTarget.push(targetChart);
  }
  return chartsWithoutTarget;
}

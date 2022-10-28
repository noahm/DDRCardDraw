import { ReactNode } from "react";
import { draw } from "./card-draw";
import { useConfigState } from "./config-state";
import { createContextualStore } from "./zustand/contextual-zustand";
import { useDrawState } from "./draw-state";
import {
  Drawing,
  EligibleChart,
  PlayerActionOnChart,
  PocketPick,
} from "./models/Drawing";
import { SerializibleStore } from "./zustand/shared-zustand";

const stubDrawing: Drawing = {
  id: "stub",
  charts: [],
  bans: [],
  pocketPicks: [],
  protects: [],
};

interface DrawingProviderProps {
  initialDrawing: Drawing;
  children?: ReactNode;
}

export interface DrawingContext extends Drawing, SerializibleStore<Drawing> {
  updateDrawing: (d: Partial<Drawing>) => void;
  redrawChart(chartId: number): void;
  resetChart(chartId: number): void;
  /**
   * handles any of the protect/pocket-pick/ban actions a user may take on a drawn chart
   * @param action type of action being performed
   * @param chartId id of the chart being acted upon
   * @param player the player acting on the chart, 1 or 2
   * @param chart new chart being pocket picked, if this is a pocket pick action
   */
  handleBanProtectReplace(
    action: "ban" | "protect" | "pocket",
    chartId: number,
    player: 1 | 2,
    chart?: EligibleChart
  ): void;
}

function keyFromAction(action: "ban" | "protect" | "pocket") {
  switch (action) {
    case "ban":
      return "bans";
    case "protect":
      return "protects";
    case "pocket":
      return "pocketPicks";
  }
}

const {
  Provider: DrawingProvider,
  useContextValue: useDrawing,
  StoreIndex: allDrawingStores,
  useStore: useDrawingStore,
} = createContextualStore<DrawingContext, DrawingProviderProps>(
  (props, set, get) => ({
    ...props.initialDrawing,
    updateDrawing: set,
    resetChart(chartId) {
      set((d) => ({
        bans: d.bans.filter((p) => p.chartId !== chartId),
        protects: d.protects.filter((p) => p.chartId !== chartId),
        pocketPicks: d.pocketPicks.filter((p) => p.chartId !== chartId),
      }));
    },
    redrawChart(chartId) {
      const newChart = draw(useDrawState.getState().gameData!, {
        ...useConfigState.getState(),
        chartCount: 1,
      }).charts[0];
      set((d) => ({
        charts: d.charts.map((chart) => {
          if (chart.id === chartId) {
            newChart.id = chartId;
            return newChart;
          }
          return chart;
        }),
      }));
    },
    handleBanProtectReplace(action, chartId, player, newChart) {
      const drawing = get();
      const charts = drawing.charts.slice();
      const key = keyFromAction(action);
      const arr = drawing[key].slice() as PlayerActionOnChart[] | PocketPick[];

      if (useConfigState.getState().orderByAction) {
        const indexToCut = charts.findIndex((chart) => chart.id === chartId);
        const [shiftedChart] = charts.splice(indexToCut, 1);
        if (action === "ban") {
          // insert at tail of list
          const insertPoint = charts.length;
          charts.splice(insertPoint, 0, shiftedChart);
        } else {
          // insert at head of list, behind other picks
          const insertPoint =
            drawing.protects.length + drawing.pocketPicks.length;
          charts.splice(insertPoint, 0, shiftedChart);
        }
        set({
          charts,
        });
      }

      const existingBanIndex = arr.findIndex((b) => b.chartId === chartId);
      if (existingBanIndex >= 0) {
        arr.splice(existingBanIndex, 1);
      } else {
        arr.push({ player, pick: newChart!, chartId });
      }
      set({
        [key]: arr,
      });
    },
    serializeSyncFields() {
      return Object.entries(get()).reduce((ret: Partial<Drawing>, [k, v]) => {
        if (typeof v === "function") {
          return ret;
        }
        if (k.startsWith("__")) {
          return ret;
        }
        ret[k as keyof Drawing] = v;
        return ret;
      }, {}) as Drawing;
    },
  }),
  (p) => p.initialDrawing.id,
  { initialDrawing: stubDrawing }
);

export { useDrawing, DrawingProvider, allDrawingStores, useDrawingStore };

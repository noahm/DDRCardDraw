import { AppThunk } from "./store";
import { draw, StartggInfo } from "../card-draw";
import { loadStockGamedataByName } from "./game-data.atoms";
import { drawingsSlice } from "./drawings.slice";
import { EligibleChart } from "../models/Drawing";
import { configSlice, ConfigState, defaultConfig } from "./config.slice";

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
 * Thunk creator for performing a new draw
 * @returns false if draw was unsuccessful
 */
export function createDraw(startggTargetSet: StartggInfo): AppThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const config = configSlice.selectors.getCurrent(state);
    if (!config) {
      console.error("couldnt draw, no config");
      return false;
    }
    const gameData = await loadStockGamedataByName(config.gameKey);
    if (!gameData) {
      console.error("couldnt draw, no game data");
      trackDraw(null);
      return false; // no draw was possible
    }

    const drawing = draw(gameData, config, startggTargetSet);
    trackDraw(drawing.charts.length, gameData.i18n.en.name as string);
    if (!drawing.charts.length) {
      return false; // could not draw the requested number of charts
    }

    dispatch(drawingsSlice.actions.addDrawing(drawing));
  };
}

/**
 * thunk creator for redrawing all charts in a target drawing
 */
export function createRedrawAll(drawingId: string): AppThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const drawing = state.drawings.entities[drawingId];
    const originalConfig = state.config.entities[drawing.configId];
    const drawConfig = {
      ...originalConfig,
      chartCount: drawing.charts.length,
    };
    const gameData = await loadStockGamedataByName(originalConfig.gameKey);

    // preserve pocket picks and protects in the redraw by keeping them in the starting point info
    // and filtering out all other charts
    const protectedChartIds = new Set(
      Object.keys(drawing.pocketPicks).concat(Object.keys(drawing.protects)),
    );
    const chartsToKeep = drawing.charts.filter(
      (chart) =>
        protectedChartIds.has(chart.id) || chart.type === "PLACEHOLDER",
    );
    const startingPoint = {
      ...drawing,
      charts: chartsToKeep,
    };

    const drawResult = draw(gameData!, drawConfig, startingPoint);
    dispatch(
      drawingsSlice.actions.updateOne({
        id: drawingId,
        changes: {
          charts: chartsToKeep.concat(drawResult.charts),
          pocketPicks: drawing.pocketPicks,
          bans: {},
          protects: drawing.protects,
          winners: {},
        },
      }),
    );
  };
}

/**
 * thunk creator for redrawing a single chart within a drawing
 */
export function createRedrawChart(
  drawingId: string,
  chartId: string,
): AppThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const drawing = state.drawings.entities[drawingId];
    const originalConfig = state.config.entities[drawing.configId];
    const gameData = await loadStockGamedataByName(originalConfig.gameKey);
    if (!gameData) return;
    const startingPoint = {
      ...drawing,
      charts: drawing.charts.filter((chart) => chart.id !== chartId),
    };

    const drawResult = draw(gameData, originalConfig, startingPoint);
    const chart = drawResult.charts.pop();
    if (
      !chart ||
      chart.type !== "DRAWN" ||
      drawing.charts.some((c) => c.id === chart.id)
    ) {
      return; // result didn't include a new chart
    }
    dispatch(
      drawingsSlice.actions.updateOneChart({
        drawingId,
        chartId,
        changes: chart,
      }),
    );
  };
}

/** thunk creator for pick/ban/pocket pick that can include orderByAction setting */
export function createPickBanPocket(
  drawingId: string,
  chartId: string,
  type: "ban" | "protect" | "pocket",
  player: number,
  pick?: EligibleChart,
): AppThunk {
  return (dispatch, getState) => {
    const reorder =
      !!configSlice.selectors.getCurrent(getState())?.orderByAction;
    let action;
    if (type === "pocket") {
      if (pick) {
        action = drawingsSlice.actions.banProtectReplace({
          drawingId,
          chartId,
          type,
          player,
          pick,
          reorder,
        });
      }
    } else {
      action = drawingsSlice.actions.banProtectReplace({
        drawingId,
        chartId,
        type,
        player,
        reorder,
      });
    }
    if (action) {
      dispatch(action);
    }
  };
}

import { GameData } from "../models/SongData";
import { nanoid } from "nanoid";

function getOverridesFromGameData(gameData: GameData) {
  const {
    flags,
    difficulties,
    folders,
    style,
    lowerLvlBound: lowerBound,
    upperLvlBound: upperBound,
  } = gameData.defaults;
  const gameSpecificOverrides: Partial<ConfigState> = {
    lowerBound,
    upperBound,
    flags,
    difficulties,
    style,
    cutoffDate: "",
  };
  if (folders) {
    gameSpecificOverrides.folders = folders;
  }
  if (!gameData.meta.granularTierResolution) {
    gameSpecificOverrides.useGranularLevels = false;
  }
  return gameSpecificOverrides;
}

export function createConfigFromInputs(
  name: string,
  gameKey: string,
  basisConfigId?: string,
): AppThunk {
  return async (dispatch, getState) => {
    const gameData = await loadStockGamedataByName(gameKey);
    const basisConfig = basisConfigId
      ? getState().config.entities[basisConfigId]
      : {};
    const newConfig: ConfigState = {
      ...defaultConfig,
      ...basisConfig,
      id: nanoid(10),
      name,
      gameKey,
    };
    if (gameData) {
      Object.assign(newConfig, getOverridesFromGameData(gameData));
    }
    dispatch(configSlice.actions.addOne(newConfig));
  };
}

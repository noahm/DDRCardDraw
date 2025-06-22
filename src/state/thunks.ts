import { AppThunk } from "./store";
import { draw, DrawingMeta } from "../card-draw";
import {
  getLastGameSelected,
  loadStockGamedataByName,
} from "./game-data.atoms";
import { drawingsSlice, getDrawingFromCompoundId } from "./drawings.slice";
import { CompoundSetId, EligibleChart } from "../models/Drawing";
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
export function createDraw(
  startggTargetSet: DrawingMeta,
  configId: string,
): AppThunk<Promise<"nok" | "ok">> {
  return async (dispatch, getState) => {
    const state = getState();
    const config = configSlice.selectors.selectById(state, configId);
    if (!config) {
      console.error("couldnt draw, no config");
      return "nok";
    }
    const gameData = await loadStockGamedataByName(config.gameKey);
    if (!gameData) {
      console.error("couldnt draw, no game data");
      trackDraw(null);
      return "nok"; // no draw was possible
    }

    const charts = draw(gameData, config, startggTargetSet);
    trackDraw(charts.length, gameData.i18n.en.name as string);
    if (!charts.length) {
      return "nok"; // could not draw the requested number of charts
    }

    const players =
      startggTargetSet.meta.type === "simple"
        ? startggTargetSet.meta.players
        : startggTargetSet.meta.entrants;

    const matchId = `draw-${nanoid(10)}`;
    const setId = `set-${nanoid(12)}`;

    dispatch(
      drawingsSlice.actions.addDrawing({
        id: matchId,
        winners: {},
        bans: {},
        protects: {},
        pocketPicks: {},
        meta: startggTargetSet.meta,
        playerDisplayOrder: players.map((_, idx) => idx),
        configId,
        subDrawings: {
          [setId]: {
            compoundId: [matchId, setId],
            configId,
            charts,
          },
        },
      }),
    );
    return "ok";
  };
}

/**
 * Thunk creator for performing a new draw, and adding it
 * as a sub-draw of an existing draw
 * @returns false if draw was unsuccessful
 */
export function createSubdraw(
  parentDrawId: string,
  configId: string,
): AppThunk<Promise<"nok" | "ok">> {
  return async (dispatch, getState) => {
    const state = getState();
    const config = configSlice.selectors.selectById(state, configId);
    if (!config) {
      console.error("couldnt draw, no config");
      return "nok";
    }
    const gameData = await loadStockGamedataByName(config.gameKey);
    if (!gameData) {
      console.error("couldnt draw, no game data");
      trackDraw(null);
      return "nok"; // no draw was possible
    }
    const existingDraw = state.drawings.entities[parentDrawId];

    const charts = draw(gameData, config, { meta: existingDraw.meta });
    trackDraw(charts.length, gameData.i18n.en.name as string);
    if (!charts.length) {
      return "nok"; // could not draw the requested number of charts
    }

    const setId = `set-${nanoid(12)}`;
    dispatch(
      drawingsSlice.actions.addSubdraw({
        existingDrawId: parentDrawId,
        newSubdraw: {
          compoundId: [parentDrawId, setId],
          configId,
          charts,
        },
      }),
    );
    return "ok";
  };
}

/**
 * thunk creator for redrawing all charts in a target drawing
 */
export function createRedrawAll(drawingId: CompoundSetId): AppThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const [parent, target] = getDrawingFromCompoundId(
      state.drawings,
      drawingId,
    );
    const originalConfig = state.config.entities[target.configId];
    const drawConfig = {
      ...originalConfig,
      chartCount: target.charts.length,
    };
    const gameData = await loadStockGamedataByName(originalConfig.gameKey);

    // preserve pocket picks and protects in the redraw by keeping them in the starting point info
    // and filtering out all other charts
    const protectedChartIds = new Set(
      Object.keys(parent.pocketPicks).concat(Object.keys(parent.protects)),
    );
    const chartsToKeep = target.charts.filter(
      (chart) =>
        protectedChartIds.has(chart.id) || chart.type === "PLACEHOLDER",
    );

    const charts = draw(gameData!, drawConfig, {
      meta: parent.meta,
      charts: chartsToKeep,
    });
    dispatch(
      drawingsSlice.actions.updateCharts({
        drawId: drawingId,
        newCharts: chartsToKeep.concat(charts),
      }),
    );
  };
}

/**
 * thunk creator for redrawing a single chart within a drawing
 */
export function createRedrawChart(
  drawingId: CompoundSetId,
  chartId: string,
): AppThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const [parent, target] = getDrawingFromCompoundId(
      state.drawings,
      drawingId,
    );
    const originalConfig = state.config.entities[target.configId];
    const gameData = await loadStockGamedataByName(originalConfig.gameKey);
    if (!gameData) return;

    const charts = draw(gameData, originalConfig, {
      meta: parent.meta,
      charts: target.charts.filter((chart) => chart.id !== chartId),
    });
    const chart = charts.pop();
    if (
      !chart ||
      chart.type !== "DRAWN" ||
      target.charts.some((c) => c.id === chart.id)
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

/**
 * thunk creator for redrawing a single chart within a drawing
 */
export function createPlusOneChart(drawingId: CompoundSetId): AppThunk {
  return async (dispatch, getState) => {
    const state = getState();
    const [parent, target] = getDrawingFromCompoundId(
      state.drawings,
      drawingId,
    );
    const originalConfig = state.config.entities[target.configId];
    const gameData = await loadStockGamedataByName(originalConfig.gameKey);
    if (!gameData) return;

    const customConfig: ConfigState = {
      ...originalConfig,
      // force drawing one more chart than already exists
      chartCount:
        1 +
        target.charts.reduce<number>(
          (acc, curr) => (curr.type === "DRAWN" ? acc + 1 : acc),
          0,
        ),
    };

    const charts = draw(gameData, customConfig, {
      meta: parent.meta,
      charts: target.charts,
    });
    const chart = charts.pop();
    if (
      !chart ||
      chart.type !== "DRAWN" ||
      target.charts.some((c) => c.id === chart.id)
    ) {
      return; // result didn't include a new chart
    }
    dispatch(
      drawingsSlice.actions.addOneChart({
        drawingId,
        chart,
      }),
    );
  };
}

/** thunk creator for pick/ban/pocket pick that can include orderByAction setting */
export function createPickBanPocket(
  drawingId: CompoundSetId,
  chartId: string,
  type: "ban" | "protect" | "pocket",
  player: number,
  pick?: EligibleChart,
): AppThunk {
  return (dispatch, getState) => {
    const state = getState();
    const [, target] = getDrawingFromCompoundId(state.drawings, drawingId);
    const reorder = !!configSlice.selectors.selectById(state, target.configId)
      ?.orderByAction;
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
import { availableGameData } from "../utils";

function getOverridesFromGameData(gameData?: GameData): Partial<ConfigState> {
  if (!gameData) return {};
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

export function createNewConfig(
  roomName: string,
  basisConfigId?: string,
): AppThunk<Promise<ConfigState>> {
  return async (dispatch, getState) => {
    const basisConfig: Partial<ConfigState> = basisConfigId
      ? getState().config.entities[basisConfigId]
      : {};
    const gameKey =
      basisConfig.gameKey ||
      getLastGameSelected(roomName) ||
      availableGameData[0].name;
    const gameData = await loadStockGamedataByName(gameKey);
    const newConfig: ConfigState = {
      ...defaultConfig,
      ...getOverridesFromGameData(gameData),
      ...basisConfig,
      id: nanoid(10),
      name: basisConfig.name ? `copy of ${basisConfig.name}` : "new config",
      gameKey,
    };
    dispatch(configSlice.actions.addOne(newConfig));
    return newConfig;
  };
}

export function createConfigFromInputs(
  name: string,
  gameKey: string,
  basisConfigId?: string,
): AppThunk<Promise<ConfigState>> {
  return async (dispatch, getState) => {
    const gameData = await loadStockGamedataByName(gameKey);
    const basisConfig = basisConfigId
      ? getState().config.entities[basisConfigId]
      : {};
    const newConfig: ConfigState = {
      ...defaultConfig,
      ...getOverridesFromGameData(gameData),
      ...basisConfig,
      id: nanoid(10),
      name,
      gameKey,
    };
    dispatch(configSlice.actions.addOne(newConfig));
    return newConfig;
  };
}

export function createConfigFromImport(
  name: string,
  gameKey: string,
  imported: ConfigState,
): AppThunk<Promise<ConfigState>> {
  return async (dispatch) => {
    const gameData = await loadStockGamedataByName(gameKey);
    const basisConfig = imported;
    const newConfig: ConfigState = {
      ...defaultConfig,
      ...getOverridesFromGameData(gameData),
      ...basisConfig,
      id: nanoid(10),
      name,
      gameKey,
    };
    dispatch(configSlice.actions.addOne(newConfig));
    return newConfig;
  };
}

export function changeGameKeyForConfig(
  configId: string,
  gameKey: string,
): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const startingConfig = getState().config.entities[configId];
    const gameData = await loadStockGamedataByName(gameKey);
    if (!gameData) return;
    const changes: Partial<ConfigState> = { gameKey };
    if (!gameData.meta.styles.includes(startingConfig.style)) {
      changes.style = gameData.defaults.style;
    }
    if (
      startingConfig.difficulties.some(
        (d) =>
          !gameData.meta.difficulties.some((metaDiff) => metaDiff.key === d),
      )
    ) {
      changes.difficulties = gameData.defaults.difficulties;
    }
    if (
      startingConfig.flags.some(
        (f) => !gameData.meta.flags.some((metaFlag) => metaFlag === f),
      )
    ) {
      changes.flags = gameData.defaults.flags;
    }
    dispatch(configSlice.actions.updateOne({ id: configId, changes }));
  };
}

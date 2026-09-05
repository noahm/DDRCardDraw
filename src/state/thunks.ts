import { AppThunk, AppState } from "./store";
import { draw, DrawingMeta, newPlaceholder } from "../card-draw";
import { getLastGameSelected, loadGamedataByKey } from "./game-data.atoms";
import {
  drawingsSlice,
  getDrawingFromCompoundId,
  selectChartUsage,
} from "./drawings.slice";
import {
  CHART_DRAWN,
  CHART_PLACEHOLDER,
  CompoundSetId,
  Drawing,
  EligibleChart,
  SubDrawing,
} from "../models/Drawing";
import { reuseKeysForChart } from "../chart-id";
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
 * The charts this draw may not produce, or undefined when reuse is allowed and
 * every draw stands on its own as it always has.
 *
 * The set covers the *whole* history, which settles the awkward case of going
 * back to redraw an older set: draws made after it still count, because the
 * question a reuse rule answers is "has this chart been seen in this event",
 * and where in the history it was seen doesn't change the answer. It also
 * covers the charts currently in the set being redrawn, so a redraw can't hand
 * back the chart that was just rejected.
 */
function excludedKeysFor(state: AppState): Set<string> | undefined {
  if (!state.event?.settings?.preventChartReuse) return undefined;
  return selectChartUsage(state).keys;
}

/** add every key of every drawn chart in `charts` to `spentKeys`, if tracking */
function noteChartsSpent(
  spentKeys: Set<string> | undefined,
  charts: Drawing["charts"] = [],
) {
  if (!spentKeys) return;
  for (const chart of charts) {
    if (chart.type !== CHART_DRAWN) continue;
    for (const key of reuseKeysForChart(chart)) {
      spentKeys.add(key);
    }
  }
}

/** how many real charts are in a result, ignoring any player-pick placeholders */
function countDrawn(charts: Drawing["charts"] = []) {
  return charts.reduce(
    (count, c) => (c.type === CHART_DRAWN ? count + 1 : count),
    0,
  );
}

/**
 * Warn when a draw comes up short. With the reuse rule on this stops being an
 * error case and starts being the normal end of an event's pool, so it needs
 * to be visible rather than silently handing back fewer cards than asked for.
 */
function reportDrawShortfall(
  charts: Drawing["charts"],
  requested: number,
  reuseEnforced: boolean,
) {
  const drawn = countDrawn(charts);
  if (drawn >= requested) return;
  if (!drawn) {
    showDrawErrorToast(reuseEnforced);
  } else {
    showPartialDrawToast(drawn, requested);
  }
}

/**
 * Thunk creator for performing a new draw
 * @returns false if draw was unsuccessful
 */
export function createDraw(
  drawMeta: DrawingMeta,
  configId: string,
): AppThunk<Promise<"nok" | "ok">> {
  return async (dispatch, getState) => {
    const state = getState();
    const config = configSlice.selectors.selectById(state, configId);
    if (!config) {
      console.error("couldnt draw, no config");
      return "nok";
    }
    const gameData = await loadGamedataByKey(config.gameKey);
    if (!gameData) {
      console.error("couldnt draw, no game data");
      trackDraw(null);
      return "nok"; // no draw was possible
    }

    const excludedKeys = excludedKeysFor(state);
    const charts = draw(gameData, config, { ...drawMeta, excludedKeys });
    if (!charts.length) {
      showDrawErrorToast(!!excludedKeys);
      trackDraw(null);
      return "nok"; // could not draw the requested number of charts
    }
    reportDrawShortfall(charts, config.chartCount, !!excludedKeys);

    const matchId = `draw-${nanoid(10)}`;
    const setId = `set-${nanoid(12)}`;
    const mainDraw: SubDrawing = {
      compoundId: [matchId, setId],
      configId,
      charts,
    };
    const drawing: Drawing = {
      id: matchId,
      winners: {},
      bans: {},
      protects: {},
      pocketPicks: {},
      meta: drawMeta.meta,
      configId,
      subDrawings: { [setId]: mainDraw },
    };
    trackDraw(charts.length, gameData.i18n.en.name as string);

    if (config.multiDraws) {
      // the extra draws are part of the same action, so nothing has been
      // committed to history yet that they could exclude themselves against.
      // Grow a local copy as we go instead, or a merged multi-draw would
      // happily deal the same chart twice into one set.
      const spentKeys = excludedKeys && new Set(excludedKeys);
      noteChartsSpent(spentKeys, charts);

      for (const otherConfigId of config.multiDraws.configs) {
        const otherConfig = configSlice.selectors.selectById(
          state,
          otherConfigId,
        );
        if (!otherConfig) {
          console.error("couldnt perform extra draw, no config");
          continue;
        }
        const otherGameData = await loadGamedataByKey(otherConfig.gameKey);
        if (!otherGameData) {
          console.error("couldnt perform extra draw, no game data");
          continue;
        }
        const otherCharts = draw(otherGameData, otherConfig, {
          ...drawMeta,
          excludedKeys: spentKeys,
        });
        if (!otherCharts.length) {
          continue; // could not draw the requested number of charts
        }
        noteChartsSpent(spentKeys, otherCharts);

        trackDraw(otherCharts.length, otherGameData.i18n.en.name as string);
        if (config.multiDraws.merge) {
          mainDraw.charts = mainDraw.charts.concat(otherCharts);
        } else {
          const otherSetId = `set-${nanoid(12)}`;
          drawing.subDrawings[otherSetId] = {
            compoundId: [drawing.id, otherSetId],
            configId: otherConfigId,
            charts: otherCharts,
          };
        }
      }
    }

    dispatch(drawingsSlice.actions.addDrawing(drawing));
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
    const gameData = await loadGamedataByKey(config.gameKey);
    if (!gameData) {
      console.error("couldnt draw, no game data");
      trackDraw(null);
      return "nok"; // no draw was possible
    }
    const existingDraw = state.drawings.entities[parentDrawId];

    const excludedKeys = excludedKeysFor(state);
    const charts = draw(gameData, config, {
      meta: existingDraw.meta,
      excludedKeys,
    });
    trackDraw(charts.length, gameData.i18n.en.name as string);
    if (!charts.length) {
      showDrawErrorToast(!!excludedKeys);
      return "nok"; // could not draw the requested number of charts
    }
    reportDrawShortfall(charts, config.chartCount, !!excludedKeys);

    const setId = `set-${nanoid(12)}`;
    dispatch(
      drawingsSlice.actions.addSubdraw({
        existingDrawId: parentDrawId,
        newSubdraw: { compoundId: [parentDrawId, setId], configId, charts },
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

    // preserve pocket picks and protects in the redraw by keeping them in the starting point info
    // and filtering out all other charts
    const protectedChartIds = new Set(
      Object.keys(parent.pocketPicks).concat(Object.keys(parent.protects)),
    );
    const chartsToKeep = target.charts.filter(
      (chart) =>
        protectedChartIds.has(chart.id) || chart.type === "PLACEHOLDER",
    );

    const originalConfig = state.config.entities[target.configId];
    const drawConfig: ConfigState = {
      ...originalConfig,
      chartCount: target.charts.length - chartsToKeep.length,
    };
    const gameData = await loadGamedataByKey(originalConfig.gameKey);

    const excludedKeys = excludedKeysFor(state);
    const charts = draw(gameData!, drawConfig, {
      meta: parent.meta,
      charts: chartsToKeep,
      excludedKeys,
    });
    reportDrawShortfall(charts, drawConfig.chartCount, !!excludedKeys);
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
    const customConfig: ConfigState = {
      ...state.config.entities[target.configId],
    };
    const gameData = await loadGamedataByKey(customConfig.gameKey);
    if (!gameData) return;

    const excludedKeys = excludedKeysFor(state);
    const charts = draw(gameData, customConfig, {
      meta: parent.meta,
      charts: target.charts.filter((chart) => chart.id !== chartId),
      excludedKeys,
    });
    const chart = charts.pop();
    if (
      !chart ||
      chart.type !== "DRAWN" ||
      target.charts.some((c) => c.id === chart.id)
    ) {
      showDrawErrorToast(!!excludedKeys);
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
 * thunk creator for adding one more chart to an existing drawing
 */
export function createPlusOneChart(
  drawingId: CompoundSetId,
  type: "DRAWN" | "PLACEHOLDER",
): AppThunk {
  return async (dispatch, getState) => {
    if (type === CHART_PLACEHOLDER) {
      return dispatch(
        drawingsSlice.actions.addOneChart({
          drawingId,
          chart: newPlaceholder(),
        }),
      );
    }
    const state = getState();
    const [parent, target] = getDrawingFromCompoundId(
      state.drawings,
      drawingId,
    );
    const originalConfig = state.config.entities[target.configId];
    const gameData = await loadGamedataByKey(originalConfig.gameKey);
    if (!gameData) return;

    const customConfig: ConfigState = {
      ...originalConfig,
      // force drawing one more chart than already exists
      chartCount: 1 + countDrawn(target.charts),
    };

    const excludedKeys = excludedKeysFor(state);
    const charts = draw(gameData, customConfig, {
      meta: parent.meta,
      charts: target.charts,
      excludedKeys,
    });
    const chart = charts.pop();
    if (
      !chart ||
      chart.type !== "DRAWN" ||
      target.charts.some((c) => c.id === chart.id)
    ) {
      showDrawErrorToast(!!excludedKeys);
      return; // result didn't include a new chart
    }
    return dispatch(drawingsSlice.actions.addOneChart({ drawingId, chart }));
  };
}

/** thunk creator for pick/ban/pocket pick that can include orderByAction setting */
export function createPickBanPocket(
  drawingId: CompoundSetId,
  chartId: string,
  type: "ban" | "protect" | "pocket",
  player: string,
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
import {
  showDrawErrorToast,
  showPartialDrawToast,
} from "../draw-state/error-toast";

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
    const gameData = await loadGamedataByKey(gameKey);
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
    const gameData = await loadGamedataByKey(gameKey);
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
    const gameData = await loadGamedataByKey(gameKey);
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
    const gameData = await loadGamedataByKey(gameKey);
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
    changes.upperBound = gameData.defaults.upperLvlBound;
    changes.lowerBound = gameData.defaults.lowerLvlBound;
    dispatch(configSlice.actions.updateOne({ id: configId, changes }));
  };
}

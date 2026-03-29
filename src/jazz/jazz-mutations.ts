/**
 * Jazz Mutations
 *
 * All state-mutating operations as plain async/sync functions that take
 * the Jazz room (and owner Group) directly.  Replaces:
 *   - src/jazz/room-mutations.ts  (low-level CoValue writes)
 *   - src/state/thunks.ts         (async draw/config operations)
 *
 * Components call these functions (bound via useMutations()) instead of
 * dispatching Redux actions.
 */

import { nanoid } from "nanoid";
import { draw, DrawingMeta, newPlaceholder } from "../card-draw";
import { loadStockGamedataByName, getLastGameSelected } from "../state/game-data.atoms";
import { availableGameData } from "../utils";
import { showDrawErrorToast } from "../draw-state/error-toast";
import type {
  Drawing,
  SubDrawing,
  EligibleChart,
  CompoundSetId,
} from "../models/Drawing";
import { CHART_PLACEHOLDER, CHART_DRAWN } from "../models/Drawing";
import { defaultConfig, type ConfigState } from "../state/config.slice";
import type { GameData } from "../models/SongData";
import {
  JazzDrawing,
  JazzConfig,
  JazzWinnersRecord,
  JazzPlayerAction,
  JazzPlayerActionRecord,
  JazzPocketPick,
  JazzPocketPickRecord,
  JazzSubDrawing,
  JazzSubDrawingRecord,
  JazzCab,
  JazzCabRecord,
  JazzObsLabel,
  JazzObsLabelRecord,
} from "./schema";
import {
  type JazzRoomInstance,
  type JazzDrawingInstance,
  type JazzConfigInstance,
  type JazzSubDrawingInstance,
  type JazzCabInstance,
  jazzDrawingToDrawing,
  jazzConfigToConfig,
  drawingScalarInit,
  configToJazzInit,
  findJazzDrawing,
  findJazzConfig,
} from "./converters";
import type { Group } from "jazz-tools";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CoRecordLike = {
  $jazz: { set(k: string, v: unknown): void; delete(k: string): void };
};

function jset(
  comap: { $jazz: { set(key: string, value: unknown): void } },
  key: string,
  value: unknown,
) {
  comap.$jazz.set(key, value);
}

/** Get a plain Drawing from the room (for reading in async operations). */
export function getDrawing(
  room: JazzRoomInstance,
  drawingId: string,
): Drawing | null {
  const jd = findJazzDrawing(room, drawingId);
  return jd ? jazzDrawingToDrawing(jd) : null;
}

/** Get a plain ConfigState from the room. */
export function getConfig(
  room: JazzRoomInstance,
  configId: string,
): ConfigState | null {
  const jc = findJazzConfig(room, configId);
  return jc ? jazzConfigToConfig(jc) : null;
}

/** Get parent drawing + target sub-drawing from a compound ID. */
export function getDrawingAndSub(
  room: JazzRoomInstance,
  compoundId: CompoundSetId,
): [Drawing, SubDrawing] | null {
  const drawing = getDrawing(room, compoundId[0]);
  if (!drawing) return null;
  const sub = drawing.subDrawings[compoundId[1]];
  if (!sub) return null;
  return [drawing, sub];
}

function getOverridesFromGameData(gameData?: GameData): Partial<ConfigState> {
  if (!gameData) return {};
  const { flags, difficulties, folders, style, lowerLvlBound: lowerBound, upperLvlBound: upperBound } =
    gameData.defaults;
  const overrides: Partial<ConfigState> = {
    lowerBound, upperBound, flags, difficulties, style, cutoffDate: "",
  };
  if (folders) overrides.folders = folders;
  if (!gameData.meta.granularTierResolution) overrides.useGranularLevels = false;
  return overrides;
}

declare const umami: {
  track(name?: string, props?: Record<string, string | number | undefined>): void;
};

function trackDraw(count: number | null, game?: string) {
  if (typeof umami === "undefined") return;
  umami.track("cards-drawn", count === null ? { result: "failed" } : { result: "success", count, game });
}

// ---------------------------------------------------------------------------
// Drawing CRUD
// ---------------------------------------------------------------------------

export function jazzClearDrawings(room: JazzRoomInstance) {
  const list = room.drawings as unknown as JazzDrawingInstance[];
  const listJazz = room.drawings as unknown as { $jazz: { splice(i: number, n: number): void } };
  const len = list?.length ?? 0;
  if (len > 0) listJazz.$jazz.splice(0, len);
}

export function jazzRemoveDrawing(room: JazzRoomInstance, compoundId: CompoundSetId) {
  const [mainId, subId] = compoundId;
  const list = room.drawings as unknown as JazzDrawingInstance[];
  const listJazz = room.drawings as unknown as { $jazz: { splice(i: number, n: number): void } };

  if (!subId || subId === mainId) {
    const idx = list?.findIndex((jd) => jd?.id === mainId) ?? -1;
    if (idx !== -1) listJazz.$jazz.splice(idx, 1);
  } else {
    const jd = findJazzDrawing(room, mainId);
    if (!jd) return;
    const rawJd = jd as unknown as {
      subDrawings: CoRecordLike & Record<string, JazzSubDrawingInstance | null>;
      winners: CoRecordLike;
      bans: CoRecordLike;
      protects: CoRecordLike;
      pocketPicks: CoRecordLike;
    };
    const jSub = rawJd.subDrawings[subId];
    if (!jSub) return;
    const charts: Array<{ id: string }> = JSON.parse(jSub.chartsJson as string);
    rawJd.subDrawings.$jazz.delete(subId);
    for (const { id } of charts) {
      rawJd.winners.$jazz.delete(id);
      rawJd.bans.$jazz.delete(id);
      rawJd.protects.$jazz.delete(id);
      rawJd.pocketPicks.$jazz.delete(id);
    }
  }
}

function addDrawingToJazz(
  room: JazzRoomInstance,
  owner: Group,
  drawing: Drawing,
) {
  const winners = JazzWinnersRecord.create({}, { owner });
  const bans = JazzPlayerActionRecord.create({}, { owner });
  const protects = JazzPlayerActionRecord.create({}, { owner });
  const pocketPicks = JazzPocketPickRecord.create({}, { owner });
  const subDrawings = JazzSubDrawingRecord.create({}, { owner });

  for (const [chartId, player] of Object.entries(drawing.winners)) {
    if (player != null)
      (winners as unknown as CoRecordLike).$jazz.set(chartId, player);
  }
  for (const [chartId, action] of Object.entries(drawing.bans)) {
    if (action != null) {
      const ja = JazzPlayerAction.create({ player: action.player, chartId: action.chartId }, { owner });
      (bans as unknown as CoRecordLike).$jazz.set(chartId, ja);
    }
  }
  for (const [chartId, action] of Object.entries(drawing.protects)) {
    if (action != null) {
      const ja = JazzPlayerAction.create({ player: action.player, chartId: action.chartId }, { owner });
      (protects as unknown as CoRecordLike).$jazz.set(chartId, ja);
    }
  }
  for (const [chartId, pp] of Object.entries(drawing.pocketPicks)) {
    if (pp != null) {
      const jp = JazzPocketPick.create(
        { player: pp.player, chartId: pp.chartId, pickJson: JSON.stringify(pp.pick) },
        { owner },
      );
      (pocketPicks as unknown as CoRecordLike).$jazz.set(chartId, jp);
    }
  }
  for (const [subId, sub] of Object.entries(drawing.subDrawings)) {
    const js = JazzSubDrawing.create(
      { parentId: sub.compoundId[0], subId: sub.compoundId[1], configId: sub.configId, chartsJson: JSON.stringify(sub.charts) },
      { owner },
    );
    (subDrawings as unknown as CoRecordLike).$jazz.set(subId, js);
  }

  const jd = JazzDrawing.create(
    { ...drawingScalarInit(drawing), winners, bans, protects, pocketPicks, subDrawings },
    { owner },
  );
  (room.drawings as unknown as { $jazz: { push(v: JazzDrawingInstance): void } }).$jazz.push(jd);
}

// ---------------------------------------------------------------------------
// Per-chart mutations
// ---------------------------------------------------------------------------

export function jazzResetChart(
  room: JazzRoomInstance,
  drawingId: CompoundSetId,
  chartId: string,
) {
  const jd = findJazzDrawing(room, drawingId[0]);
  if (!jd) return;
  const rawJd = jd as unknown as {
    winners: CoRecordLike;
    bans: CoRecordLike;
    protects: CoRecordLike;
    pocketPicks: CoRecordLike;
  };
  rawJd.winners.$jazz.delete(chartId);
  rawJd.bans.$jazz.delete(chartId);
  rawJd.protects.$jazz.delete(chartId);
  rawJd.pocketPicks.$jazz.delete(chartId);
}

export function jazzSetWinner(
  room: JazzRoomInstance,
  drawingId: CompoundSetId,
  chartId: string,
  player: number | null,
) {
  const jd = findJazzDrawing(room, drawingId[0]);
  if (!jd) return;
  const rec = (jd as unknown as { winners: CoRecordLike }).winners;
  if (player === null) {
    rec.$jazz.delete(chartId);
  } else {
    rec.$jazz.set(chartId, player);
  }
}

export function jazzAddPlayerScore(
  room: JazzRoomInstance,
  drawingId: CompoundSetId,
  chartId: string,
  playerId: string,
  score: number,
) {
  const jd = findJazzDrawing(room, drawingId[0]);
  if (!jd) return;
  const rawJd = jd as unknown as { metaJson: string };
  const meta = JSON.parse(rawJd.metaJson);
  if (meta.type !== "startgg" || meta.subtype !== "gauntlet") return;
  const scoresByEntrant = meta.scoresByEntrant ?? {};
  jset(jd, "metaJson", JSON.stringify({
    ...meta,
    scoresByEntrant: {
      ...scoresByEntrant,
      [playerId]: { ...scoresByEntrant[playerId], [chartId]: score },
    },
  }));
}

export function jazzUpdateDrawingMeta(
  room: JazzRoomInstance,
  drawingId: string,
  meta: Drawing["meta"],
  playerDisplayOrder: number[],
) {
  const jd = findJazzDrawing(room, drawingId);
  if (!jd) return;
  jset(jd, "metaJson", JSON.stringify(meta));
  jset(jd, "playerDisplayOrderJson", JSON.stringify(playerDisplayOrder));
}

export function jazzSwapPlayerPositions(room: JazzRoomInstance, drawingId: string) {
  const jd = findJazzDrawing(room, drawingId);
  if (!jd) return;
  const order: number[] = JSON.parse((jd as unknown as { playerDisplayOrderJson: string }).playerDisplayOrderJson);
  jset(jd, "playerDisplayOrderJson", JSON.stringify([...order].reverse()));
}

export function jazzIncrementPriorityPlayer(room: JazzRoomInstance, drawingId: string) {
  const jd = findJazzDrawing(room, drawingId);
  if (!jd) return;
  const order: number[] = JSON.parse((jd as unknown as { playerDisplayOrderJson: string }).playerDisplayOrderJson);
  const current = jd.priorityPlayer ?? undefined;
  if (!current) {
    jset(jd, "priorityPlayer", 1);
  } else {
    const next = current + 1;
    if (next >= order.length + 1) {
      (jd.$jazz as { delete(key: string): void }).delete("priorityPlayer");
    } else {
      jset(jd, "priorityPlayer", next);
    }
  }
}

export function jazzMergeDraws(
  room: JazzRoomInstance,
  owner: Group,
  drawingId: string,
  newSubdrawId: string,
) {
  const jd = findJazzDrawing(room, drawingId);
  if (!jd) return;

  const rawSubDrawings = (
    jd as unknown as { subDrawings: Record<string, JazzSubDrawingInstance | null> & CoRecordLike }
  ).subDrawings;

  const allCharts: unknown[] = [];
  for (const v of Object.values(rawSubDrawings) as Array<JazzSubDrawingInstance | null>) {
    if (v != null) allCharts.push(...JSON.parse((v as unknown as { chartsJson: string }).chartsJson));
  }
  for (const k of Object.keys(rawSubDrawings)) {
    rawSubDrawings.$jazz.delete(k);
  }

  const js = JazzSubDrawing.create(
    { parentId: drawingId, subId: newSubdrawId, configId: (jd as unknown as { configId: string }).configId, chartsJson: JSON.stringify(allCharts) },
    { owner },
  );
  rawSubDrawings.$jazz.set(newSubdrawId, js);

  // Mirror cab activeMatch update
  const rawCabs = (room as unknown as { cabs: Record<string, JazzCabInstance | null> & CoRecordLike }).cabs;
  for (const [, cab] of Object.entries(rawCabs) as Array<[string, JazzCabInstance | null]>) {
    if (cab == null) continue;
    const cabRaw = cab as unknown as { activeMatchJson: string | null };
    const activeMatch = cabRaw.activeMatchJson ? JSON.parse(cabRaw.activeMatchJson) : null;
    if (Array.isArray(activeMatch) && activeMatch[0] === drawingId) {
      jset(cab as unknown as { $jazz: { set(k: string, v: unknown): void } }, "activeMatchJson", JSON.stringify([drawingId, newSubdrawId]));
    }
  }
}

// ---------------------------------------------------------------------------
// Config mutations
// ---------------------------------------------------------------------------

function addConfigToJazz(room: JazzRoomInstance, owner: Group, config: ConfigState) {
  const jc = JazzConfig.create(configToJazzInit(config), { owner });
  (room.configs as unknown as { $jazz: { push(v: JazzConfigInstance): void } }).$jazz.push(jc);
}

export function jazzRemoveConfig(room: JazzRoomInstance, configId: string) {
  const list = room.configs as unknown as JazzConfigInstance[];
  const listJazz = room.configs as unknown as { $jazz: { splice(i: number, n: number): void } };
  const idx = list?.findIndex((jc) => jc?.id === configId) ?? -1;
  if (idx !== -1) listJazz.$jazz.splice(idx, 1);
}

export function jazzUpdateConfig(
  room: JazzRoomInstance,
  configId: string,
  changes: Partial<ConfigState>,
) {
  const jc = findJazzConfig(room, configId);
  if (!jc) return;

  for (const f of ["name", "gameKey", "style", "cutoffDate"] as const) {
    if (changes[f] !== undefined) jset(jc, f, changes[f]);
  }
  for (const f of ["chartCount", "playerPicks", "upperBound", "lowerBound", "defaultPlayersPerDraw", "probabilityBucketCount"] as const) {
    if (changes[f] !== undefined) jset(jc, f, changes[f]);
  }
  for (const f of ["useWeights", "orderByAction", "hideVetos", "forceDistribution", "constrainPocketPicks", "sortByLevel", "useGranularLevels"] as const) {
    if (changes[f] !== undefined) jset(jc, f, changes[f]);
  }
  if (changes.weights !== undefined) jset(jc, "weightsJson", JSON.stringify(changes.weights));
  if (changes.folders !== undefined) jset(jc, "foldersJson", JSON.stringify(changes.folders));
  if (changes.difficulties !== undefined) jset(jc, "difficultiesJson", JSON.stringify(changes.difficulties));
  if (changes.flags !== undefined) jset(jc, "flagsJson", JSON.stringify(changes.flags));
  if ("multiDraws" in changes) {
    jset(jc, "multiDrawsJson", changes.multiDraws ? JSON.stringify(changes.multiDraws) : undefined);
  }
}

// ---------------------------------------------------------------------------
// Event mutations
// ---------------------------------------------------------------------------

export function jazzAddCab(room: JazzRoomInstance, owner: Group, name: string) {
  const id = nanoid(5);
  const jc = JazzCab.create({ id, name, activeMatchJson: null }, { owner });
  (room as unknown as { cabs: CoRecordLike }).cabs.$jazz.set(id, jc);
}

export function jazzRemoveCab(room: JazzRoomInstance, cabId: string) {
  (room as unknown as { cabs: CoRecordLike }).cabs.$jazz.delete(cabId);
}

export function jazzClearCabAssignment(room: JazzRoomInstance, cabId: string) {
  const cab = (room as unknown as { cabs: Record<string, JazzCabInstance | null> }).cabs?.[cabId];
  if (cab) jset(cab, "activeMatchJson", null);
}

export function jazzAssignToCab(
  room: JazzRoomInstance,
  cabId: string,
  matchId: string | [string, string],
) {
  const cab = (room as unknown as { cabs: Record<string, JazzCabInstance | null> }).cabs?.[cabId];
  if (cab) jset(cab, "activeMatchJson", JSON.stringify(matchId));
}

export function jazzUpdateLabel(
  room: JazzRoomInstance,
  owner: Group,
  id: string,
  label: string,
  value: string,
) {
  const rawLabels = (room as unknown as { obsLabels: CoRecordLike & Record<string, unknown> }).obsLabels;
  const existing = (rawLabels as Record<string, unknown>)[id];
  if (existing != null) {
    jset(existing as { $jazz: { set(k: string, v: unknown): void } }, "label", label);
    jset(existing as { $jazz: { set(k: string, v: unknown): void } }, "value", value);
  } else {
    const jl = JazzObsLabel.create({ label, value }, { owner });
    rawLabels.$jazz.set(id, jl);
  }
}

export function jazzRemoveLabel(room: JazzRoomInstance, id: string) {
  (room as unknown as { obsLabels: CoRecordLike }).obsLabels.$jazz.delete(id);
}

export function jazzUpdateObsCss(room: JazzRoomInstance, css: string) {
  jset(room as unknown as { $jazz: { set(k: string, v: unknown): void } }, "obsCss", css);
}

// ---------------------------------------------------------------------------
// Async draw operations
// ---------------------------------------------------------------------------

export async function jazzNewDraw(
  room: JazzRoomInstance,
  owner: Group,
  drawMeta: DrawingMeta,
  configId: string,
): Promise<"ok" | "nok"> {
  const config = getConfig(room, configId);
  if (!config) {
    console.error("couldnt draw, no config");
    return "nok";
  }
  const gameData = await loadStockGamedataByName(config.gameKey);
  if (!gameData) {
    console.error("couldnt draw, no game data");
    trackDraw(null);
    return "nok";
  }

  const charts = draw(gameData, config, drawMeta);
  if (!charts.length) {
    showDrawErrorToast();
    trackDraw(null);
    return "nok";
  }

  const players =
    drawMeta.meta.type === "simple" ? drawMeta.meta.players : drawMeta.meta.entrants;

  const matchId = `draw-${nanoid(10)}`;
  const setId = `set-${nanoid(12)}`;
  const mainDraw: SubDrawing = { compoundId: [matchId, setId], configId, charts };
  const drawing: Drawing = {
    id: matchId,
    winners: {},
    bans: {},
    protects: {},
    pocketPicks: {},
    meta: drawMeta.meta,
    playerDisplayOrder: players.map((_, idx) => idx),
    configId,
    subDrawings: { [setId]: mainDraw },
  };
  trackDraw(charts.length, gameData.i18n.en.name as string);

  if (config.multiDraws) {
    for (const otherConfigId of config.multiDraws.configs) {
      const otherConfig = getConfig(room, otherConfigId);
      if (!otherConfig) { console.error("couldnt perform extra draw, no config"); continue; }
      const otherGameData = await loadStockGamedataByName(otherConfig.gameKey);
      if (!otherGameData) { console.error("couldnt perform extra draw, no game data"); continue; }
      const otherCharts = draw(otherGameData, otherConfig, drawMeta);
      if (!otherCharts.length) continue;
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

  addDrawingToJazz(room, owner, drawing);
  return "ok";
}

export async function jazzNewSubdraw(
  room: JazzRoomInstance,
  owner: Group,
  parentDrawId: string,
  configId: string,
): Promise<"ok" | "nok"> {
  const config = getConfig(room, configId);
  if (!config) { console.error("couldnt draw, no config"); return "nok"; }
  const gameData = await loadStockGamedataByName(config.gameKey);
  if (!gameData) { console.error("couldnt draw, no game data"); trackDraw(null); return "nok"; }

  const parentDrawing = getDrawing(room, parentDrawId);
  if (!parentDrawing) { console.error("couldnt draw, no parent drawing"); return "nok"; }

  const charts = draw(gameData, config, { meta: parentDrawing.meta });
  trackDraw(charts.length, gameData.i18n.en.name as string);
  if (!charts.length) { showDrawErrorToast(); return "nok"; }

  const setId = `set-${nanoid(12)}`;
  const jd = findJazzDrawing(room, parentDrawId);
  if (!jd) return "nok";
  const js = JazzSubDrawing.create(
    { parentId: parentDrawId, subId: setId, configId, chartsJson: JSON.stringify(charts) },
    { owner },
  );
  (jd as unknown as { subDrawings: CoRecordLike }).subDrawings.$jazz.set(setId, js);
  return "ok";
}

export async function jazzRedrawAll(
  room: JazzRoomInstance,
  owner: Group,
  drawId: CompoundSetId,
) {
  const pair = getDrawingAndSub(room, drawId);
  if (!pair) return;
  const [parent, target] = pair;

  const protectedChartIds = new Set(
    Object.keys(parent.pocketPicks).concat(Object.keys(parent.protects)),
  );
  const chartsToKeep = target.charts.filter(
    (chart) => protectedChartIds.has(chart.id) || chart.type === "PLACEHOLDER",
  );

  const originalConfig = getConfig(room, target.configId);
  if (!originalConfig) return;
  const drawConfig: ConfigState = { ...originalConfig, chartCount: target.charts.length - chartsToKeep.length };
  const gameData = await loadStockGamedataByName(originalConfig.gameKey);

  const charts = draw(gameData!, drawConfig, { meta: parent.meta, charts: chartsToKeep });
  const newCharts = chartsToKeep.concat(charts);

  // updateCharts mutation
  const jd = findJazzDrawing(room, drawId[0]);
  if (!jd) return;
  const newChartIds = new Set(newCharts.map((c) => c.id));
  const rawJd = jd as unknown as {
    winners: CoRecordLike & Record<string, unknown>;
    bans: CoRecordLike & Record<string, unknown>;
    protects: CoRecordLike & Record<string, unknown>;
    pocketPicks: CoRecordLike & Record<string, unknown>;
  };
  for (const key of Object.keys(rawJd.winners ?? {})) {
    if (!newChartIds.has(key)) rawJd.winners.$jazz.delete(key);
  }
  for (const key of Object.keys(rawJd.bans ?? {})) {
    if (!newChartIds.has(key)) rawJd.bans.$jazz.delete(key);
  }
  for (const key of Object.keys(rawJd.protects ?? {})) {
    if (!newChartIds.has(key)) rawJd.protects.$jazz.delete(key);
  }
  for (const key of Object.keys(rawJd.pocketPicks ?? {})) {
    if (!newChartIds.has(key)) rawJd.pocketPicks.$jazz.delete(key);
  }
  const jSub = (jd as unknown as { subDrawings: Record<string, JazzSubDrawingInstance | null> }).subDrawings?.[drawId[1]];
  if (jSub) jset(jSub, "chartsJson", JSON.stringify(newCharts));
}

export async function jazzRedrawChart(
  room: JazzRoomInstance,
  drawId: CompoundSetId,
  chartId: string,
) {
  const pair = getDrawingAndSub(room, drawId);
  if (!pair) return;
  const [parent, target] = pair;
  const config = getConfig(room, target.configId);
  if (!config) return;
  const gameData = await loadStockGamedataByName(config.gameKey);
  if (!gameData) return;

  const charts = draw(gameData, config, {
    meta: parent.meta,
    charts: target.charts.filter((chart) => chart.id !== chartId),
  });
  const chart = charts.pop();
  if (!chart || chart.type !== CHART_DRAWN || target.charts.some((c) => c.id === chart.id)) {
    showDrawErrorToast();
    return;
  }

  const jd = findJazzDrawing(room, drawId[0]);
  if (!jd) return;
  const jSub = (jd as unknown as { subDrawings: Record<string, JazzSubDrawingInstance | null> }).subDrawings?.[drawId[1]];
  if (!jSub) return;
  const charts2: Array<{ id: string }> = JSON.parse(jSub.chartsJson as string);
  const updated = charts2.map((c) => (c.id === chartId ? { ...c, ...chart } : c));
  jset(jSub, "chartsJson", JSON.stringify(updated));
}

export async function jazzPlusOneChart(
  room: JazzRoomInstance,
  drawId: CompoundSetId,
  type: typeof CHART_DRAWN | typeof CHART_PLACEHOLDER,
) {
  const jd = findJazzDrawing(room, drawId[0]);
  if (!jd) return;
  const jSub = (jd as unknown as { subDrawings: Record<string, JazzSubDrawingInstance | null> }).subDrawings?.[drawId[1]];
  if (!jSub) return;

  if (type === CHART_PLACEHOLDER) {
    const charts: unknown[] = JSON.parse(jSub.chartsJson as string);
    jset(jSub, "chartsJson", JSON.stringify([...charts, newPlaceholder()]));
    return;
  }

  const pair = getDrawingAndSub(room, drawId);
  if (!pair) return;
  const [parent, target] = pair;
  const config = getConfig(room, target.configId);
  if (!config) return;
  const gameData = await loadStockGamedataByName(config.gameKey);
  if (!gameData) return;

  const customConfig: ConfigState = {
    ...config,
    chartCount: 1 + target.charts.reduce<number>((acc, c) => (c.type === CHART_DRAWN ? acc + 1 : acc), 0),
  };
  const charts = draw(gameData, customConfig, { meta: parent.meta, charts: target.charts });
  const chart = charts.pop();
  if (!chart || chart.type !== CHART_DRAWN || target.charts.some((c) => c.id === chart.id)) {
    showDrawErrorToast();
    return;
  }
  const existing: unknown[] = JSON.parse(jSub.chartsJson as string);
  jset(jSub, "chartsJson", JSON.stringify([...existing, chart]));
}

export function jazzPickBanPocket(
  room: JazzRoomInstance,
  owner: Group,
  drawId: CompoundSetId,
  chartId: string,
  type: "ban" | "protect" | "pocket",
  player: number,
  pick?: EligibleChart,
) {
  const pair = getDrawingAndSub(room, drawId);
  if (!pair) return;
  const [, target] = pair;
  const config = getConfig(room, target.configId);
  const reorder = !!config?.orderByAction;

  const jd = findJazzDrawing(room, drawId[0]);
  if (!jd) return;

  if (type === "ban") {
    if (reorder) _reorderChart(jd, drawId[1], chartId, "end");
    const ja = JazzPlayerAction.create({ player, chartId }, { owner });
    (jd as unknown as { bans: CoRecordLike }).bans.$jazz.set(chartId, ja);
  } else if (type === "protect") {
    if (reorder) _reorderChart(jd, drawId[1], chartId, "start");
    const ja = JazzPlayerAction.create({ player, chartId }, { owner });
    (jd as unknown as { protects: CoRecordLike }).protects.$jazz.set(chartId, ja);
  } else if (type === "pocket" && pick) {
    if (reorder) _reorderChart(jd, drawId[1], chartId, "start");
    const jp = JazzPocketPick.create({ player, chartId, pickJson: JSON.stringify(pick) }, { owner });
    (jd as unknown as { pocketPicks: CoRecordLike }).pocketPicks.$jazz.set(chartId, jp);
  }
}

function _reorderChart(
  jd: JazzDrawingInstance,
  subId: string,
  chartId: string,
  pos: "start" | "end",
) {
  const rawJd = jd as unknown as {
    protects: Record<string, unknown>;
    pocketPicks: Record<string, unknown>;
  };
  const protectCount = Object.keys(rawJd.protects ?? {}).length;
  const pocketCount = Object.keys(rawJd.pocketPicks ?? {}).length;

  const jSub = (jd as unknown as { subDrawings: Record<string, JazzSubDrawingInstance | null> }).subDrawings?.[subId];
  if (!jSub) return;
  const charts: Array<{ id: string }> = JSON.parse(jSub.chartsJson as string);
  const target = charts.find((c) => c.id === chartId);
  if (!target) return;
  const without = charts.filter((c) => c.id !== chartId);
  if (pos === "end") {
    jset(jSub, "chartsJson", JSON.stringify([...without, target]));
  } else {
    const newCharts = [...without];
    newCharts.splice(protectCount + pocketCount, 0, target);
    jset(jSub, "chartsJson", JSON.stringify(newCharts));
  }
}

// ---------------------------------------------------------------------------
// Config async operations
// ---------------------------------------------------------------------------

export async function jazzNewConfig(
  room: JazzRoomInstance,
  owner: Group,
  roomName: string,
  basisConfigId?: string,
): Promise<ConfigState> {
  const basisConfig: Partial<ConfigState> = basisConfigId ? (getConfig(room, basisConfigId) ?? {}) : {};
  const gameKey = basisConfig.gameKey || getLastGameSelected(roomName) || availableGameData[0].name;
  const gameData = await loadStockGamedataByName(gameKey);
  const newConfig: ConfigState = {
    ...defaultConfig,
    ...getOverridesFromGameData(gameData),
    ...basisConfig,
    id: nanoid(10),
    name: basisConfig.name ? `copy of ${basisConfig.name}` : "new config",
    gameKey,
  };
  addConfigToJazz(room, owner, newConfig);
  return newConfig;
}

export async function jazzNewConfigFromInputs(
  room: JazzRoomInstance,
  owner: Group,
  name: string,
  gameKey: string,
  basisConfigId?: string,
): Promise<ConfigState> {
  const gameData = await loadStockGamedataByName(gameKey);
  const basisConfig = basisConfigId ? (getConfig(room, basisConfigId) ?? {}) : {};
  const newConfig: ConfigState = {
    ...defaultConfig,
    ...getOverridesFromGameData(gameData),
    ...basisConfig,
    id: nanoid(10),
    name,
    gameKey,
  };
  addConfigToJazz(room, owner, newConfig);
  return newConfig;
}

export async function jazzNewConfigFromImport(
  room: JazzRoomInstance,
  owner: Group,
  name: string,
  gameKey: string,
  imported: ConfigState,
): Promise<ConfigState> {
  const gameData = await loadStockGamedataByName(gameKey);
  const newConfig: ConfigState = {
    ...defaultConfig,
    ...getOverridesFromGameData(gameData),
    ...imported,
    id: nanoid(10),
    name,
    gameKey,
  };
  addConfigToJazz(room, owner, newConfig);
  return newConfig;
}

export async function jazzChangeGameKey(
  room: JazzRoomInstance,
  configId: string,
  gameKey: string,
) {
  const startingConfig = getConfig(room, configId);
  if (!startingConfig) return;
  const gameData = await loadStockGamedataByName(gameKey);
  if (!gameData) return;
  const changes: Partial<ConfigState> = { gameKey };
  if (!gameData.meta.styles.includes(startingConfig.style)) changes.style = gameData.defaults.style;
  if (startingConfig.difficulties.some((d) => !gameData.meta.difficulties.some((md) => md.key === d))) {
    changes.difficulties = gameData.defaults.difficulties;
  }
  if (startingConfig.flags.some((f) => !gameData.meta.flags.some((mf) => mf === f))) {
    changes.flags = gameData.defaults.flags;
  }
  changes.upperBound = gameData.defaults.upperLvlBound;
  changes.lowerBound = gameData.defaults.lowerLvlBound;
  jazzUpdateConfig(room, configId, changes);
}

export function jazzAddConfig(room: JazzRoomInstance, owner: Group, config: ConfigState) {
  addConfigToJazz(room, owner, config);
}

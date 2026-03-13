/**
 * Room mutations — Redux actions → Jazz CoValue writes
 *
 * This module translates every Redux action that modifies shared state into a
 * direct mutation of the corresponding Jazz CoValue.  This replaces both the
 * PartyKit listener (which serialised and broadcast actions over WebSocket)
 * and the Redux reducer logic for the persisted slices.
 *
 * Jazz takes care of syncing the mutations to all connected clients via CRDT,
 * so we no longer need a server-side room or WebSocket infrastructure.
 *
 * Pattern:
 *   - drawingsSlice actions  → mutate a JazzDrawing in room.drawings
 *   - configSlice actions    → mutate a JazzConfig in room.configs
 *   - eventSlice actions     → mutate room.cabsJson / obsLabelsJson / obsCss
 *   - mergeDraws (central)   → restructure a JazzDrawing's subDrawingsJson
 *
 * All CoMap mutations use `$jazz.set(key, value)` — the documented Jazz API.
 * All CoList mutations use `.$jazz.push()` / `.$jazz.splice()`.
 */

import type { Action } from "@reduxjs/toolkit";
import { nanoid } from "nanoid";
import { drawingsSlice } from "../state/drawings.slice";
import { configSlice, ConfigState } from "../state/config.slice";
import { eventSlice, CabInfo } from "../state/event.slice";
import { mergeDraws } from "../state/central";
import type { Drawing, SubDrawing } from "../models/Drawing";
import { JazzDrawing, JazzConfig } from "./schema";
import {
  type JazzRoomInstance,
  type JazzDrawingInstance,
  type JazzConfigInstance,
  drawingToJazzInit,
  configToJazzInit,
  findJazzDrawing,
  findJazzConfig,
  mutateDrawingJson,
  mutateRoomJson,
} from "./converters";

// Shorthand for CoMap $jazz.set — avoids repeating the cast
function jset(
  comap: { $jazz: { set(key: string, value: unknown): void } },
  key: string,
  value: unknown,
) {
  comap.$jazz.set(key, value);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Apply a Redux action as a Jazz mutation.
 * Call this from the Redux listener middleware instead of the PartyKit broadcast.
 *
 * The `room.owner` Group is used for new CoValue creation so all nested
 * values inherit the room's permission settings (e.g. public write).
 */
export function applyActionToJazz(
  action: Action,
  room: JazzRoomInstance,
): void {
  const owner = (room as unknown as { owner: import("jazz-tools").Group }).owner;

  if (drawingsSlice.actions.addDrawing.match(action)) {
    addDrawing(room, action.payload as Drawing, owner);
  } else if (drawingsSlice.actions.updateOne.match(action)) {
    updateDrawing(room, action.payload as { id: string; changes: Partial<Drawing> });
  } else if (drawingsSlice.actions.removeOne.match(action)) {
    removeDrawing(room, action.payload as [string, string]);
  } else if (drawingsSlice.actions.clearDrawings.match(action)) {
    clearDrawings(room);
  } else if (drawingsSlice.actions.addOneChart.match(action)) {
    addOneChart(room, action.payload as { drawingId: [string, string]; chart: unknown });
  } else if (drawingsSlice.actions.updateOneChart.match(action)) {
    updateOneChart(room, action.payload as { drawingId: [string, string]; chartId: string; changes: object });
  } else if (drawingsSlice.actions.swapPlayerPositions.match(action)) {
    swapPlayerPositions(room, action.payload as string);
  } else if (drawingsSlice.actions.incrementPriorityPlayer.match(action)) {
    incrementPriorityPlayer(room, action.payload as string);
  } else if (drawingsSlice.actions.resetChart.match(action)) {
    resetChart(room, action.payload as { drawingId: [string, string]; chartId: string });
  } else if (drawingsSlice.actions.banProtectReplace.match(action)) {
    banProtectReplace(room, action.payload as BanProtectPayload);
  } else if (drawingsSlice.actions.setWinner.match(action)) {
    setWinner(room, action.payload as { drawingId: [string, string]; chartId: string; player: number | null });
  } else if (drawingsSlice.actions.addPlayerScore.match(action)) {
    addPlayerScore(room, action.payload as { drawingId: [string, string]; chartId: string; playerId: string; score: number });
  } else if (drawingsSlice.actions.addSubdraw.match(action)) {
    addSubdraw(room, action.payload as { existingDrawId: string; newSubdraw: SubDrawing });
  } else if (drawingsSlice.actions.updateCharts.match(action)) {
    updateCharts(room, action.payload as { drawId: [string, string]; newCharts: SubDrawing["charts"] });
  } else if (configSlice.actions.addOne.match(action)) {
    addConfig(room, action.payload as ConfigState, owner);
  } else if (configSlice.actions.updateOne.match(action)) {
    updateConfig(room, action.payload as { id: string; changes: Partial<ConfigState> });
  } else if (configSlice.actions.removeOne.match(action)) {
    removeConfig(room, action.payload as string);
  } else if (eventSlice.actions.addCab.match(action)) {
    mutateRoomJson(room, "cabsJson", (cabs: Record<string, CabInfo>) => {
      const id = nanoid(5);
      return { ...cabs, [id]: { id, name: action.payload as string, activeMatch: null } };
    });
  } else if (eventSlice.actions.removeCab.match(action)) {
    mutateRoomJson(room, "cabsJson", (cabs: Record<string, CabInfo>) => {
      const next = { ...cabs };
      delete next[action.payload as string];
      return next;
    });
  } else if (eventSlice.actions.clearCabAssignment.match(action)) {
    mutateRoomJson(room, "cabsJson", (cabs: Record<string, CabInfo>) => {
      if (!cabs[action.payload as string]) return cabs;
      return { ...cabs, [action.payload as string]: { ...cabs[action.payload as string], activeMatch: null } };
    });
  } else if (eventSlice.actions.assignMatchToCab.match(action)) {
    const { cabId, matchId } = action.payload as { cabId: string; matchId: string };
    mutateRoomJson(room, "cabsJson", (cabs: Record<string, CabInfo>) => {
      if (!cabs[cabId]) return cabs;
      return { ...cabs, [cabId]: { ...cabs[cabId], activeMatch: matchId } };
    });
  } else if (eventSlice.actions.assignSetToCab.match(action)) {
    const { cabId, matchId } = action.payload as { cabId: string; matchId: [string, string] };
    mutateRoomJson(room, "cabsJson", (cabs: Record<string, CabInfo>) => {
      if (!cabs[cabId]) return cabs;
      return { ...cabs, [cabId]: { ...cabs[cabId], activeMatch: matchId } };
    });
  } else if (eventSlice.actions.updateLabel.match(action)) {
    const { id, label, value } = action.payload as { id: string; label: string; value: string };
    mutateRoomJson(room, "obsLabelsJson", (labels) => ({ ...labels, [id]: { label, value } }));
  } else if (eventSlice.actions.removeLabel.match(action)) {
    mutateRoomJson(room, "obsLabelsJson", (labels) => {
      const next = { ...labels };
      delete next[(action.payload as { id: string }).id];
      return next;
    });
  } else if (eventSlice.actions.updateObsCss.match(action)) {
    jset(room as unknown as { $jazz: { set(k: string, v: unknown): void } }, "obsCss", action.payload);
  } else if (mergeDraws.match(action)) {
    applyMergeDraws(room, action.payload);
  }
}

// ---------------------------------------------------------------------------
// Drawing mutations
// ---------------------------------------------------------------------------

type BanProtectPayload = {
  drawingId: [string, string];
  chartId: string;
  player: number;
  reorder: boolean;
} & ({ type: "ban" | "protect" } | { type: "pocket"; pick: unknown });

function addDrawing(
  room: JazzRoomInstance,
  drawing: Drawing,
  owner: import("jazz-tools").Group,
) {
  const jd = JazzDrawing.create(drawingToJazzInit(drawing), { owner });
  const list = room.drawings as unknown as { $jazz: { push(v: JazzDrawingInstance): void } };
  list.$jazz.push(jd);
}

function updateDrawing(
  room: JazzRoomInstance,
  update: { id: string; changes: Partial<Drawing> },
) {
  const jd = findJazzDrawing(room, update.id);
  if (!jd) return;
  const { changes } = update;
  if (changes.meta !== undefined) jset(jd, "metaJson", JSON.stringify(changes.meta));
  if (changes.winners !== undefined) jset(jd, "winnersJson", JSON.stringify(changes.winners));
  if (changes.bans !== undefined) jset(jd, "bansJson", JSON.stringify(changes.bans));
  if (changes.protects !== undefined) jset(jd, "protectsJson", JSON.stringify(changes.protects));
  if (changes.pocketPicks !== undefined) jset(jd, "pocketPicksJson", JSON.stringify(changes.pocketPicks));
  if (changes.subDrawings !== undefined) jset(jd, "subDrawingsJson", JSON.stringify(changes.subDrawings));
  if (changes.playerDisplayOrder !== undefined)
    jset(jd, "playerDisplayOrderJson", JSON.stringify(changes.playerDisplayOrder));
  if (changes.priorityPlayer !== undefined) jset(jd, "priorityPlayer", changes.priorityPlayer);
}

function removeDrawing(room: JazzRoomInstance, compoundId: [string, string]) {
  const [mainId, subId] = compoundId;
  const list = room.drawings as unknown as JazzDrawingInstance[];
  const listJazz = room.drawings as unknown as { $jazz: { splice(i: number, n: number): void } };

  if (!subId || subId === mainId) {
    const idx = list?.findIndex((jd) => jd?.id === mainId) ?? -1;
    if (idx !== -1) listJazz.$jazz.splice(idx, 1);
  } else {
    const jd = findJazzDrawing(room, mainId);
    if (!jd) return;
    mutateDrawingJson(jd, "subDrawingsJson", (subs: Record<string, SubDrawing>) => {
      const next = { ...subs };
      const target = next[subId];
      if (target) {
        delete next[subId];
        // Clean action records for removed charts
        const removedIds = new Set(target.charts.map((c) => c.id));
        for (const field of ["winnersJson", "bansJson", "protectsJson", "pocketPicksJson"] as const) {
          mutateDrawingJson(jd, field, (v: Record<string, unknown>) => {
            const r = { ...v };
            for (const id of removedIds) delete r[id];
            return r;
          });
        }
      }
      return next;
    });
  }
}

function clearDrawings(room: JazzRoomInstance) {
  const list = room.drawings as unknown as JazzDrawingInstance[];
  const listJazz = room.drawings as unknown as { $jazz: { splice(i: number, n: number): void } };
  const len = list?.length ?? 0;
  if (len > 0) listJazz.$jazz.splice(0, len);
}

function addOneChart(
  room: JazzRoomInstance,
  payload: { drawingId: [string, string]; chart: unknown },
) {
  const [mainId, subId] = payload.drawingId;
  const jd = findJazzDrawing(room, mainId);
  if (!jd) return;
  mutateDrawingJson(jd, "subDrawingsJson", (subs: Record<string, SubDrawing>) => {
    const sub = subs[subId];
    if (!sub) return subs;
    return { ...subs, [subId]: { ...sub, charts: [...sub.charts, payload.chart] } };
  });
}

function updateOneChart(
  room: JazzRoomInstance,
  payload: { drawingId: [string, string]; chartId: string; changes: object },
) {
  const [mainId, subId] = payload.drawingId;
  const jd = findJazzDrawing(room, mainId);
  if (!jd) return;
  mutateDrawingJson(jd, "subDrawingsJson", (subs: Record<string, SubDrawing>) => {
    const sub = subs[subId];
    if (!sub) return subs;
    const charts = sub.charts.map((c) =>
      c.id === payload.chartId ? { ...c, ...payload.changes } : c,
    );
    return { ...subs, [subId]: { ...sub, charts } };
  });
}

function swapPlayerPositions(room: JazzRoomInstance, drawingId: string) {
  const jd = findJazzDrawing(room, drawingId);
  if (!jd) return;
  mutateDrawingJson(jd, "playerDisplayOrderJson", (order: number[]) =>
    [...order].reverse(),
  );
}

function incrementPriorityPlayer(room: JazzRoomInstance, drawingId: string) {
  const jd = findJazzDrawing(room, drawingId);
  if (!jd) return;
  const order: number[] = JSON.parse(jd.playerDisplayOrderJson);
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

function resetChart(
  room: JazzRoomInstance,
  payload: { drawingId: [string, string]; chartId: string },
) {
  const jd = findJazzDrawing(room, payload.drawingId[0]);
  if (!jd) return;
  const { chartId } = payload;
  for (const field of ["bansJson", "protectsJson", "pocketPicksJson", "winnersJson"] as const) {
    mutateDrawingJson(jd, field, (v: Record<string, unknown>) => {
      const n = { ...v };
      delete n[chartId];
      return n;
    });
  }
}

function banProtectReplace(room: JazzRoomInstance, payload: BanProtectPayload) {
  const [mainId, subId] = payload.drawingId;
  const jd = findJazzDrawing(room, mainId);
  if (!jd) return;
  const { chartId, player, reorder } = payload;
  const playerAction = { chartId, player };

  if (payload.type === "ban") {
    if (reorder) reorderChart(jd, subId, chartId, "end");
    mutateDrawingJson(jd, "bansJson", (v) => ({ ...v, [chartId]: playerAction }));
  } else if (payload.type === "protect") {
    if (reorder) reorderChart(jd, subId, chartId, "start");
    mutateDrawingJson(jd, "protectsJson", (v) => ({ ...v, [chartId]: playerAction }));
  } else if (payload.type === "pocket") {
    if (reorder) reorderChart(jd, subId, chartId, "start");
    mutateDrawingJson(jd, "pocketPicksJson", (v) => ({
      ...v,
      [chartId]: { chartId, player, pick: payload.pick },
    }));
  }
}

function reorderChart(
  jd: JazzDrawingInstance,
  subId: string,
  chartId: string,
  pos: "start" | "end",
) {
  const protects = Object.keys(JSON.parse(jd.protectsJson));
  const pocketPicks = Object.keys(JSON.parse(jd.pocketPicksJson));

  mutateDrawingJson(jd, "subDrawingsJson", (subs: Record<string, SubDrawing>) => {
    const sub = subs[subId];
    if (!sub) return subs;
    const target = sub.charts.find((c) => c.id === chartId);
    if (!target) return subs;
    const without = sub.charts.filter((c) => c.id !== chartId);
    if (pos === "end") {
      return { ...subs, [subId]: { ...sub, charts: [...without, target] } };
    } else {
      const insertIdx = protects.length + pocketPicks.length;
      const charts = [...without];
      charts.splice(insertIdx, 0, target);
      return { ...subs, [subId]: { ...sub, charts } };
    }
  });
}

function setWinner(
  room: JazzRoomInstance,
  payload: { drawingId: [string, string]; chartId: string; player: number | null },
) {
  const jd = findJazzDrawing(room, payload.drawingId[0]);
  if (!jd) return;
  if (payload.player === null) {
    mutateDrawingJson(jd, "winnersJson", (v: Record<string, unknown>) => {
      const n = { ...v };
      delete n[payload.chartId];
      return n;
    });
  } else {
    mutateDrawingJson(jd, "winnersJson", (v) => ({ ...v, [payload.chartId]: payload.player }));
  }
}

function addPlayerScore(
  room: JazzRoomInstance,
  payload: { drawingId: [string, string]; chartId: string; playerId: string; score: number },
) {
  const jd = findJazzDrawing(room, payload.drawingId[0]);
  if (!jd) return;
  mutateDrawingJson(jd, "metaJson", (meta) => {
    if (meta.type !== "startgg" || meta.subtype !== "gauntlet") return meta;
    const scoresByEntrant = meta.scoresByEntrant ?? {};
    return {
      ...meta,
      scoresByEntrant: {
        ...scoresByEntrant,
        [payload.playerId]: {
          ...scoresByEntrant[payload.playerId],
          [payload.chartId]: payload.score,
        },
      },
    };
  });
}

function addSubdraw(
  room: JazzRoomInstance,
  payload: { existingDrawId: string; newSubdraw: SubDrawing },
) {
  const jd = findJazzDrawing(room, payload.existingDrawId);
  if (!jd) return;
  mutateDrawingJson(jd, "subDrawingsJson", (subs: Record<string, SubDrawing>) => ({
    ...subs,
    [payload.newSubdraw.compoundId[1]]: payload.newSubdraw,
  }));
}

function updateCharts(
  room: JazzRoomInstance,
  payload: { drawId: [string, string]; newCharts: SubDrawing["charts"] },
) {
  const [mainId, subId] = payload.drawId;
  const jd = findJazzDrawing(room, mainId);
  if (!jd) return;
  const newChartIds = new Set(payload.newCharts.map((c) => c.id));

  for (const field of ["winnersJson", "bansJson", "protectsJson", "pocketPicksJson"] as const) {
    mutateDrawingJson(jd, field, (v: Record<string, unknown>) => {
      const n = { ...v };
      for (const key of Object.keys(n)) {
        if (!newChartIds.has(key)) delete n[key];
      }
      return n;
    });
  }

  mutateDrawingJson(jd, "subDrawingsJson", (subs: Record<string, SubDrawing>) => {
    const sub = subs[subId];
    if (!sub) return subs;
    return { ...subs, [subId]: { ...sub, charts: payload.newCharts } };
  });
}

function applyMergeDraws(
  room: JazzRoomInstance,
  payload: { drawingId: string; newSubdrawId: string },
) {
  const jd = findJazzDrawing(room, payload.drawingId);
  if (!jd) return;
  mutateDrawingJson(jd, "subDrawingsJson", (subs: Record<string, SubDrawing>) => {
    const allCharts = Object.values(subs).flatMap((s) => s.charts);
    return {
      [payload.newSubdrawId]: {
        compoundId: [payload.drawingId, payload.newSubdrawId],
        configId: jd.configId,
        charts: allCharts,
      },
    };
  });
  // Mirror the cab activeMatch update that event.slice's extraReducer does
  mutateRoomJson(room, "cabsJson", (cabs: Record<string, CabInfo>) => {
    const next = { ...cabs };
    for (const [id, cab] of Object.entries(next)) {
      if (Array.isArray(cab.activeMatch) && cab.activeMatch[0] === payload.drawingId) {
        next[id] = { ...cab, activeMatch: [payload.drawingId, payload.newSubdrawId] };
      }
    }
    return next;
  });
}

// ---------------------------------------------------------------------------
// Config mutations
// ---------------------------------------------------------------------------

function addConfig(
  room: JazzRoomInstance,
  config: ConfigState,
  owner: import("jazz-tools").Group,
) {
  const jc = JazzConfig.create(configToJazzInit(config), { owner });
  const list = room.configs as unknown as { $jazz: { push(v: JazzConfigInstance): void } };
  list.$jazz.push(jc);
}

function updateConfig(
  room: JazzRoomInstance,
  update: { id: string; changes: Partial<ConfigState> },
) {
  const jc = findJazzConfig(room, update.id);
  if (!jc) return;
  const { changes } = update;

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

function removeConfig(room: JazzRoomInstance, configId: string) {
  const list = room.configs as unknown as JazzConfigInstance[];
  const listJazz = room.configs as unknown as { $jazz: { splice(i: number, n: number): void } };
  const idx = list?.findIndex((jc) => jc?.id === configId) ?? -1;
  if (idx !== -1) listJazz.$jazz.splice(idx, 1);
}

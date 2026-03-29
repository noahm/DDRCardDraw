/**
 * Room mutations — Redux actions → Jazz CoValue writes
 *
 * Translates every Redux action that modifies shared state into a direct
 * mutation of the corresponding Jazz CoValue.  Jazz syncs mutations to all
 * connected clients via CRDT, so no server-side room or WebSocket is needed.
 *
 * Pattern:
 *   - drawingsSlice actions  → mutate a JazzDrawing in room.drawings
 *   - configSlice actions    → mutate a JazzConfig in room.configs
 *   - eventSlice actions     → mutate room.cabs / room.obsLabels / room.obsCss
 *   - mergeDraws (central)   → restructure a JazzDrawing's subDrawings record
 *
 * All CoMap / CoRecord mutations use `$jazz.set(key, value)` / `$jazz.delete(key)`.
 * All CoList mutations use `.$jazz.push()` / `.$jazz.splice()`.
 */

import type { Action } from "@reduxjs/toolkit";
import { nanoid } from "nanoid";
import { drawingsSlice } from "../state/drawings.slice";
import { configSlice, ConfigState } from "../state/config.slice";
import { eventSlice, CabInfo } from "../state/event.slice";
import { mergeDraws } from "../state/central";
import type { Drawing, SubDrawing } from "../models/Drawing";
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
  type JazzPlayerActionInstance,
  type JazzPocketPickInstance,
  type JazzSubDrawingInstance,
  type JazzCabInstance,
  drawingScalarInit,
  configToJazzInit,
  findJazzDrawing,
  findJazzConfig,
} from "./converters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for CoMap/CoRecord $jazz.set — avoids repeating the cast. */
function jset(
  comap: { $jazz: { set(key: string, value: unknown): void } },
  key: string,
  value: unknown,
) {
  comap.$jazz.set(key, value);
}

/** Shorthand for CoMap/CoRecord $jazz.delete. */
function jdel(
  comap: { $jazz: { delete(key: string): void } },
  key: string,
) {
  comap.$jazz.delete(key);
}

type CoRecordLike = {
  $jazz: { set(k: string, v: unknown): void; delete(k: string): void };
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function applyActionToJazz(
  action: Action,
  room: JazzRoomInstance,
): void {
  const owner = (room as unknown as { owner: import("jazz-tools").Group }).owner;

  if (drawingsSlice.actions.addDrawing.match(action)) {
    addDrawing(room, action.payload as Drawing, owner);
  } else if (drawingsSlice.actions.updateOne.match(action)) {
    updateDrawing(
      room,
      action.payload as { id: string; changes: Partial<Drawing> },
      owner,
    );
  } else if (drawingsSlice.actions.removeOne.match(action)) {
    removeDrawing(room, action.payload as [string, string]);
  } else if (drawingsSlice.actions.clearDrawings.match(action)) {
    clearDrawings(room);
  } else if (drawingsSlice.actions.addOneChart.match(action)) {
    addOneChart(
      room,
      action.payload as { drawingId: [string, string]; chart: unknown },
    );
  } else if (drawingsSlice.actions.updateOneChart.match(action)) {
    updateOneChart(
      room,
      action.payload as {
        drawingId: [string, string];
        chartId: string;
        changes: object;
      },
    );
  } else if (drawingsSlice.actions.swapPlayerPositions.match(action)) {
    swapPlayerPositions(room, action.payload as string);
  } else if (drawingsSlice.actions.incrementPriorityPlayer.match(action)) {
    incrementPriorityPlayer(room, action.payload as string);
  } else if (drawingsSlice.actions.resetChart.match(action)) {
    resetChart(
      room,
      action.payload as { drawingId: [string, string]; chartId: string },
    );
  } else if (drawingsSlice.actions.banProtectReplace.match(action)) {
    banProtectReplace(room, action.payload as BanProtectPayload, owner);
  } else if (drawingsSlice.actions.setWinner.match(action)) {
    setWinner(
      room,
      action.payload as {
        drawingId: [string, string];
        chartId: string;
        player: number | null;
      },
    );
  } else if (drawingsSlice.actions.addPlayerScore.match(action)) {
    addPlayerScore(
      room,
      action.payload as {
        drawingId: [string, string];
        chartId: string;
        playerId: string;
        score: number;
      },
    );
  } else if (drawingsSlice.actions.addSubdraw.match(action)) {
    addSubdraw(
      room,
      action.payload as { existingDrawId: string; newSubdraw: SubDrawing },
      owner,
    );
  } else if (drawingsSlice.actions.updateCharts.match(action)) {
    updateCharts(
      room,
      action.payload as {
        drawId: [string, string];
        newCharts: SubDrawing["charts"];
      },
    );
  } else if (configSlice.actions.addOne.match(action)) {
    addConfig(room, action.payload as ConfigState, owner);
  } else if (configSlice.actions.updateOne.match(action)) {
    updateConfig(
      room,
      action.payload as { id: string; changes: Partial<ConfigState> },
    );
  } else if (configSlice.actions.removeOne.match(action)) {
    removeConfig(room, action.payload as string);
  } else if (eventSlice.actions.addCab.match(action)) {
    addCab(room, action.payload as string, owner);
  } else if (eventSlice.actions.removeCab.match(action)) {
    removeCab(room, action.payload as string);
  } else if (eventSlice.actions.clearCabAssignment.match(action)) {
    clearCabAssignment(room, action.payload as string);
  } else if (eventSlice.actions.assignMatchToCab.match(action)) {
    const { cabId, matchId } = action.payload as {
      cabId: string;
      matchId: string;
    };
    setCabActiveMatch(room, cabId, matchId);
  } else if (eventSlice.actions.assignSetToCab.match(action)) {
    const { cabId, matchId } = action.payload as {
      cabId: string;
      matchId: [string, string];
    };
    setCabActiveMatch(room, cabId, matchId);
  } else if (eventSlice.actions.updateLabel.match(action)) {
    const { id, label, value } = action.payload as {
      id: string;
      label: string;
      value: string;
    };
    updateLabel(room, id, label, value, owner);
  } else if (eventSlice.actions.removeLabel.match(action)) {
    removeLabel(room, (action.payload as { id: string }).id);
  } else if (eventSlice.actions.updateObsCss.match(action)) {
    jset(
      room as unknown as { $jazz: { set(k: string, v: unknown): void } },
      "obsCss",
      action.payload,
    );
  } else if (mergeDraws.match(action)) {
    applyMergeDraws(room, action.payload, owner);
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

/**
 * Create all nested CoRecords and the JazzDrawing itself.
 * Must happen here (not in converters) because CoRecord.create() needs owner.
 */
function addDrawing(
  room: JazzRoomInstance,
  drawing: Drawing,
  owner: import("jazz-tools").Group,
) {
  // 1. Create empty CoRecords
  const winners = JazzWinnersRecord.create({}, { owner });
  const bans = JazzPlayerActionRecord.create({}, { owner });
  const protects = JazzPlayerActionRecord.create({}, { owner });
  const pocketPicks = JazzPocketPickRecord.create({}, { owner });
  const subDrawings = JazzSubDrawingRecord.create({}, { owner });

  // 2. Populate winners (skip null entries — absence = no winner)
  for (const [chartId, player] of Object.entries(drawing.winners)) {
    if (player != null)
      (winners as unknown as CoRecordLike).$jazz.set(chartId, player);
  }

  // 3. Populate bans
  for (const [chartId, action] of Object.entries(drawing.bans)) {
    if (action != null) {
      const ja = JazzPlayerAction.create(
        { player: action.player, chartId: action.chartId },
        { owner },
      );
      (bans as unknown as CoRecordLike).$jazz.set(chartId, ja);
    }
  }

  // 4. Populate protects
  for (const [chartId, action] of Object.entries(drawing.protects)) {
    if (action != null) {
      const ja = JazzPlayerAction.create(
        { player: action.player, chartId: action.chartId },
        { owner },
      );
      (protects as unknown as CoRecordLike).$jazz.set(chartId, ja);
    }
  }

  // 5. Populate pocketPicks
  for (const [chartId, pp] of Object.entries(drawing.pocketPicks)) {
    if (pp != null) {
      const jp = JazzPocketPick.create(
        { player: pp.player, chartId: pp.chartId, pickJson: JSON.stringify(pp.pick) },
        { owner },
      );
      (pocketPicks as unknown as CoRecordLike).$jazz.set(chartId, jp);
    }
  }

  // 6. Populate subDrawings
  for (const [subId, sub] of Object.entries(drawing.subDrawings)) {
    const js = JazzSubDrawing.create(
      {
        parentId: sub.compoundId[0],
        subId: sub.compoundId[1],
        configId: sub.configId,
        chartsJson: JSON.stringify(sub.charts),
      },
      { owner },
    );
    (subDrawings as unknown as CoRecordLike).$jazz.set(subId, js);
  }

  // 7. Create the drawing CoMap
  const jd = JazzDrawing.create(
    {
      ...drawingScalarInit(drawing),
      winners,
      bans,
      protects,
      pocketPicks,
      subDrawings,
    },
    { owner },
  );

  const list = room.drawings as unknown as {
    $jazz: { push(v: JazzDrawingInstance): void };
  };
  list.$jazz.push(jd);
}

function updateDrawing(
  room: JazzRoomInstance,
  update: { id: string; changes: Partial<Drawing> },
  owner: import("jazz-tools").Group,
) {
  const jd = findJazzDrawing(room, update.id);
  if (!jd) return;
  const { changes } = update;

  if (changes.meta !== undefined) jset(jd, "metaJson", JSON.stringify(changes.meta));
  if (changes.playerDisplayOrder !== undefined)
    jset(jd, "playerDisplayOrderJson", JSON.stringify(changes.playerDisplayOrder));
  if (changes.priorityPlayer !== undefined)
    jset(jd, "priorityPlayer", changes.priorityPlayer);

  if (changes.winners !== undefined) {
    syncWinnersRecord(jd, changes.winners);
  }
  if (changes.bans !== undefined) {
    syncPlayerActionRecord(
      jd,
      "bans",
      changes.bans as Record<string, import("../models/Drawing").PlayerActionOnChart | null>,
      owner,
    );
  }
  if (changes.protects !== undefined) {
    syncPlayerActionRecord(
      jd,
      "protects",
      changes.protects as Record<string, import("../models/Drawing").PlayerActionOnChart | null>,
      owner,
    );
  }
  if (changes.pocketPicks !== undefined) {
    syncPocketPickRecord(jd, changes.pocketPicks, owner);
  }
  if (changes.subDrawings !== undefined) {
    syncSubDrawingRecord(jd, changes.subDrawings, owner);
  }
}

/** Full-sync a winners CoRecord to match a plain JS Record<string, number | null>. */
function syncWinnersRecord(
  jd: JazzDrawingInstance,
  newWinners: Record<string, number | null>,
) {
  const rec = jd.winners as unknown as CoRecordLike &
    Record<string, number | null>;
  // Delete stale keys
  for (const k of Object.keys(rec)) {
    if (!(k in newWinners) || newWinners[k] == null) rec.$jazz.delete(k);
  }
  // Set new / changed keys
  for (const [k, v] of Object.entries(newWinners)) {
    if (v != null) rec.$jazz.set(k, v);
  }
}

function syncPlayerActionRecord(
  jd: JazzDrawingInstance,
  field: "bans" | "protects",
  newRecord: Record<
    string,
    import("../models/Drawing").PlayerActionOnChart | null
  >,
  owner: import("jazz-tools").Group,
) {
  const rec = (jd as unknown as Record<string, CoRecordLike & Record<string, JazzPlayerActionInstance | null>>)[field];
  for (const k of Object.keys(rec)) {
    if (!(k in newRecord) || newRecord[k] == null) rec.$jazz.delete(k);
  }
  for (const [k, v] of Object.entries(newRecord)) {
    if (v != null) {
      const ja = JazzPlayerAction.create(
        { player: v.player, chartId: v.chartId },
        { owner },
      );
      rec.$jazz.set(k, ja);
    }
  }
}

function syncPocketPickRecord(
  jd: JazzDrawingInstance,
  newRecord: Record<string, import("../models/Drawing").PocketPick | null>,
  owner: import("jazz-tools").Group,
) {
  const rec = (jd as unknown as {
    pocketPicks: CoRecordLike & Record<string, JazzPocketPickInstance | null>;
  }).pocketPicks;
  for (const k of Object.keys(rec)) {
    if (!(k in newRecord) || newRecord[k] == null) rec.$jazz.delete(k);
  }
  for (const [k, v] of Object.entries(newRecord)) {
    if (v != null) {
      const jp = JazzPocketPick.create(
        { player: v.player, chartId: v.chartId, pickJson: JSON.stringify(v.pick) },
        { owner },
      );
      rec.$jazz.set(k, jp);
    }
  }
}

function syncSubDrawingRecord(
  jd: JazzDrawingInstance,
  newRecord: Record<string, SubDrawing>,
  owner: import("jazz-tools").Group,
) {
  const rec = (jd as unknown as {
    subDrawings: CoRecordLike & Record<string, JazzSubDrawingInstance | null>;
  }).subDrawings;
  for (const k of Object.keys(rec)) {
    if (!(k in newRecord)) rec.$jazz.delete(k);
  }
  for (const [k, v] of Object.entries(newRecord)) {
    const js = JazzSubDrawing.create(
      {
        parentId: v.compoundId[0],
        subId: v.compoundId[1],
        configId: v.configId,
        chartsJson: JSON.stringify(v.charts),
      },
      { owner },
    );
    rec.$jazz.set(k, js);
  }
}

function removeDrawing(room: JazzRoomInstance, compoundId: [string, string]) {
  const [mainId, subId] = compoundId;
  const list = room.drawings as unknown as JazzDrawingInstance[];
  const listJazz = room.drawings as unknown as {
    $jazz: { splice(i: number, n: number): void };
  };

  if (!subId || subId === mainId) {
    // Remove the entire drawing from the list
    const idx = list?.findIndex((jd) => jd?.id === mainId) ?? -1;
    if (idx !== -1) listJazz.$jazz.splice(idx, 1);
  } else {
    // Remove just one sub-drawing and clean up its chart entries
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

    // Collect chart IDs to clean up
    const charts: Array<{ id: string }> = JSON.parse(jSub.chartsJson);
    const removedIds = new Set(charts.map((c) => c.id));

    // Delete the sub-drawing
    rawJd.subDrawings.$jazz.delete(subId);

    // Clean up per-chart action records
    for (const chartId of removedIds) {
      rawJd.winners.$jazz.delete(chartId);
      rawJd.bans.$jazz.delete(chartId);
      rawJd.protects.$jazz.delete(chartId);
      rawJd.pocketPicks.$jazz.delete(chartId);
    }
  }
}

function clearDrawings(room: JazzRoomInstance) {
  const list = room.drawings as unknown as JazzDrawingInstance[];
  const listJazz = room.drawings as unknown as {
    $jazz: { splice(i: number, n: number): void };
  };
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
  const jSub = getSubDrawing(jd, subId);
  if (!jSub) return;
  const charts = JSON.parse(jSub.chartsJson as string);
  jset(jSub, "chartsJson", JSON.stringify([...charts, payload.chart]));
}

function updateOneChart(
  room: JazzRoomInstance,
  payload: { drawingId: [string, string]; chartId: string; changes: object },
) {
  const [mainId, subId] = payload.drawingId;
  const jd = findJazzDrawing(room, mainId);
  if (!jd) return;
  const jSub = getSubDrawing(jd, subId);
  if (!jSub) return;
  const charts: Array<{ id: string }> = JSON.parse(jSub.chartsJson as string);
  const updated = charts.map((c) =>
    c.id === payload.chartId ? { ...c, ...payload.changes } : c,
  );
  jset(jSub, "chartsJson", JSON.stringify(updated));
}

function swapPlayerPositions(room: JazzRoomInstance, drawingId: string) {
  const jd = findJazzDrawing(room, drawingId);
  if (!jd) return;
  const order: number[] = JSON.parse(
    (jd as unknown as { playerDisplayOrderJson: string }).playerDisplayOrderJson,
  );
  jset(jd, "playerDisplayOrderJson", JSON.stringify([...order].reverse()));
}

function incrementPriorityPlayer(room: JazzRoomInstance, drawingId: string) {
  const jd = findJazzDrawing(room, drawingId);
  if (!jd) return;
  const order: number[] = JSON.parse(
    (jd as unknown as { playerDisplayOrderJson: string }).playerDisplayOrderJson,
  );
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
  const rawJd = jd as unknown as {
    winners: CoRecordLike;
    bans: CoRecordLike;
    protects: CoRecordLike;
    pocketPicks: CoRecordLike;
  };
  const { chartId } = payload;
  rawJd.winners.$jazz.delete(chartId);
  rawJd.bans.$jazz.delete(chartId);
  rawJd.protects.$jazz.delete(chartId);
  rawJd.pocketPicks.$jazz.delete(chartId);
}

function banProtectReplace(
  room: JazzRoomInstance,
  payload: BanProtectPayload,
  owner: import("jazz-tools").Group,
) {
  const [mainId, subId] = payload.drawingId;
  const jd = findJazzDrawing(room, mainId);
  if (!jd) return;
  const { chartId, player, reorder } = payload;

  if (payload.type === "ban") {
    if (reorder) reorderChart(jd, subId, chartId, "end");
    const ja = JazzPlayerAction.create({ player, chartId }, { owner });
    (jd as unknown as { bans: CoRecordLike }).bans.$jazz.set(chartId, ja);
  } else if (payload.type === "protect") {
    if (reorder) reorderChart(jd, subId, chartId, "start");
    const ja = JazzPlayerAction.create({ player, chartId }, { owner });
    (jd as unknown as { protects: CoRecordLike }).protects.$jazz.set(chartId, ja);
  } else if (payload.type === "pocket") {
    if (reorder) reorderChart(jd, subId, chartId, "start");
    const jp = JazzPocketPick.create(
      { player, chartId, pickJson: JSON.stringify(payload.pick) },
      { owner },
    );
    (jd as unknown as { pocketPicks: CoRecordLike }).pocketPicks.$jazz.set(
      chartId,
      jp,
    );
  }
}

function reorderChart(
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

  const jSub = getSubDrawing(jd, subId);
  if (!jSub) return;
  const charts: Array<{ id: string }> = JSON.parse(jSub.chartsJson as string);
  const target = charts.find((c) => c.id === chartId);
  if (!target) return;
  const without = charts.filter((c) => c.id !== chartId);

  let newCharts: typeof charts;
  if (pos === "end") {
    newCharts = [...without, target];
  } else {
    const insertIdx = protectCount + pocketCount;
    newCharts = [...without];
    newCharts.splice(insertIdx, 0, target);
  }
  jset(jSub, "chartsJson", JSON.stringify(newCharts));
}

function setWinner(
  room: JazzRoomInstance,
  payload: {
    drawingId: [string, string];
    chartId: string;
    player: number | null;
  },
) {
  const jd = findJazzDrawing(room, payload.drawingId[0]);
  if (!jd) return;
  const rec = (jd as unknown as { winners: CoRecordLike }).winners;
  if (payload.player === null) {
    rec.$jazz.delete(payload.chartId);
  } else {
    rec.$jazz.set(payload.chartId, payload.player);
  }
}

function addPlayerScore(
  room: JazzRoomInstance,
  payload: {
    drawingId: [string, string];
    chartId: string;
    playerId: string;
    score: number;
  },
) {
  const jd = findJazzDrawing(room, payload.drawingId[0]);
  if (!jd) return;
  const rawJd = jd as unknown as { metaJson: string };
  const meta = JSON.parse(rawJd.metaJson);
  if (meta.type !== "startgg" || meta.subtype !== "gauntlet") return;
  const scoresByEntrant = meta.scoresByEntrant ?? {};
  const newMeta = {
    ...meta,
    scoresByEntrant: {
      ...scoresByEntrant,
      [payload.playerId]: {
        ...scoresByEntrant[payload.playerId],
        [payload.chartId]: payload.score,
      },
    },
  };
  jset(jd, "metaJson", JSON.stringify(newMeta));
}

function addSubdraw(
  room: JazzRoomInstance,
  payload: { existingDrawId: string; newSubdraw: SubDrawing },
  owner: import("jazz-tools").Group,
) {
  const jd = findJazzDrawing(room, payload.existingDrawId);
  if (!jd) return;
  const sub = payload.newSubdraw;
  const js = JazzSubDrawing.create(
    {
      parentId: sub.compoundId[0],
      subId: sub.compoundId[1],
      configId: sub.configId,
      chartsJson: JSON.stringify(sub.charts),
    },
    { owner },
  );
  (jd as unknown as { subDrawings: CoRecordLike }).subDrawings.$jazz.set(
    sub.compoundId[1],
    js,
  );
}

function updateCharts(
  room: JazzRoomInstance,
  payload: { drawId: [string, string]; newCharts: SubDrawing["charts"] },
) {
  const [mainId, subId] = payload.drawId;
  const jd = findJazzDrawing(room, mainId);
  if (!jd) return;
  const newChartIds = new Set(payload.newCharts.map((c) => c.id));
  const rawJd = jd as unknown as {
    winners: CoRecordLike & Record<string, unknown>;
    bans: CoRecordLike & Record<string, unknown>;
    protects: CoRecordLike & Record<string, unknown>;
    pocketPicks: CoRecordLike & Record<string, unknown>;
  };

  // Clean up action records for charts that are being removed
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

  // Update the sub-drawing's chart list
  const jSub = getSubDrawing(jd, subId);
  if (jSub) jset(jSub, "chartsJson", JSON.stringify(payload.newCharts));
}

function applyMergeDraws(
  room: JazzRoomInstance,
  payload: { drawingId: string; newSubdrawId: string },
  owner: import("jazz-tools").Group,
) {
  const jd = findJazzDrawing(room, payload.drawingId);
  if (!jd) return;

  const rawSubDrawings = (
    jd as unknown as { subDrawings: Record<string, JazzSubDrawingInstance | null> & CoRecordLike }
  ).subDrawings;

  // Collect all charts from all existing sub-drawings
  const allCharts: unknown[] = [];
  for (const v of Object.values(rawSubDrawings)) {
    if (v != null) {
      const charts = JSON.parse(v.chartsJson as string);
      allCharts.push(...charts);
    }
  }

  // Delete all existing sub-drawings
  for (const k of Object.keys(rawSubDrawings)) {
    rawSubDrawings.$jazz.delete(k);
  }

  // Create the merged sub-drawing
  const rawJd = jd as unknown as { configId: string };
  const js = JazzSubDrawing.create(
    {
      parentId: payload.drawingId,
      subId: payload.newSubdrawId,
      configId: rawJd.configId,
      chartsJson: JSON.stringify(allCharts),
    },
    { owner },
  );
  rawSubDrawings.$jazz.set(payload.newSubdrawId, js);

  // Mirror the cab activeMatch update
  const rawCabs = (
    room as unknown as { cabs: Record<string, JazzCabInstance | null> & CoRecordLike }
  ).cabs;
  for (const [id, cab] of Object.entries(rawCabs)) {
    if (cab == null) continue;
    const activeMatch = cab.activeMatchJson
      ? JSON.parse(cab.activeMatchJson as string)
      : null;
    if (
      Array.isArray(activeMatch) &&
      activeMatch[0] === payload.drawingId
    ) {
      jset(cab, "activeMatchJson", JSON.stringify([payload.drawingId, payload.newSubdrawId]));
    }
  }
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
  const list = room.configs as unknown as {
    $jazz: { push(v: JazzConfigInstance): void };
  };
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
  for (const f of [
    "chartCount",
    "playerPicks",
    "upperBound",
    "lowerBound",
    "defaultPlayersPerDraw",
    "probabilityBucketCount",
  ] as const) {
    if (changes[f] !== undefined) jset(jc, f, changes[f]);
  }
  for (const f of [
    "useWeights",
    "orderByAction",
    "hideVetos",
    "forceDistribution",
    "constrainPocketPicks",
    "sortByLevel",
    "useGranularLevels",
  ] as const) {
    if (changes[f] !== undefined) jset(jc, f, changes[f]);
  }
  if (changes.weights !== undefined)
    jset(jc, "weightsJson", JSON.stringify(changes.weights));
  if (changes.folders !== undefined)
    jset(jc, "foldersJson", JSON.stringify(changes.folders));
  if (changes.difficulties !== undefined)
    jset(jc, "difficultiesJson", JSON.stringify(changes.difficulties));
  if (changes.flags !== undefined)
    jset(jc, "flagsJson", JSON.stringify(changes.flags));
  if ("multiDraws" in changes) {
    jset(
      jc,
      "multiDrawsJson",
      changes.multiDraws ? JSON.stringify(changes.multiDraws) : undefined,
    );
  }
}

function removeConfig(room: JazzRoomInstance, configId: string) {
  const list = room.configs as unknown as JazzConfigInstance[];
  const listJazz = room.configs as unknown as {
    $jazz: { splice(i: number, n: number): void };
  };
  const idx = list?.findIndex((jc) => jc?.id === configId) ?? -1;
  if (idx !== -1) listJazz.$jazz.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// Event mutations (cabs + obsLabels)
// ---------------------------------------------------------------------------

function addCab(
  room: JazzRoomInstance,
  name: string,
  owner: import("jazz-tools").Group,
) {
  const id = nanoid(5);
  const jc = JazzCab.create({ id, name, activeMatchJson: null }, { owner });
  (room as unknown as { cabs: CoRecordLike }).cabs.$jazz.set(id, jc);
}

function removeCab(room: JazzRoomInstance, cabId: string) {
  (room as unknown as { cabs: CoRecordLike }).cabs.$jazz.delete(cabId);
}

function clearCabAssignment(room: JazzRoomInstance, cabId: string) {
  const cab = getCab(room, cabId);
  if (cab) jset(cab, "activeMatchJson", null);
}

function setCabActiveMatch(
  room: JazzRoomInstance,
  cabId: string,
  matchId: string | [string, string],
) {
  const cab = getCab(room, cabId);
  if (cab)
    jset(cab, "activeMatchJson", JSON.stringify(matchId));
}

function updateLabel(
  room: JazzRoomInstance,
  id: string,
  label: string,
  value: string,
  owner: import("jazz-tools").Group,
) {
  const rawLabels = (
    room as unknown as { obsLabels: CoRecordLike & Record<string, unknown> }
  ).obsLabels;
  // Reuse the existing CoMap if it exists, otherwise create a new one
  const existing = (rawLabels as Record<string, unknown>)[id];
  if (existing != null) {
    const jl = existing as JazzCabInstance; // same $jazz shape
    jset(jl, "label", label);
    jset(jl, "value", value);
  } else {
    const jl = JazzObsLabel.create({ label, value }, { owner });
    rawLabels.$jazz.set(id, jl);
  }
}

function removeLabel(room: JazzRoomInstance, id: string) {
  (room as unknown as { obsLabels: CoRecordLike }).obsLabels.$jazz.delete(id);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSubDrawing(
  jd: JazzDrawingInstance,
  subId: string,
): JazzSubDrawingInstance | undefined {
  const subs = (jd as unknown as { subDrawings: Record<string, JazzSubDrawingInstance | null> })
    .subDrawings;
  return subs?.[subId] ?? undefined;
}

function getCab(
  room: JazzRoomInstance,
  cabId: string,
): JazzCabInstance | undefined {
  const cabs = (room as unknown as { cabs: Record<string, JazzCabInstance | null> }).cabs;
  return cabs?.[cabId] ?? undefined;
}

/**
 * Jazz ↔ Redux type converters
 *
 * Converts between the existing TypeScript types used by Redux slices and the
 * Jazz CoValue instances.  Used by the sync manager to populate Redux state
 * from Jazz (initial load + remote updates) and by room-mutations to apply
 * Redux actions back to Jazz.
 */

import type { InstanceOfSchema } from "jazz-tools";
import {
  type Drawing,
  type SubDrawing,
  type PlayerActionOnChart,
  type PocketPick,
} from "../models/Drawing";
import { type ConfigState } from "../state/config.slice";
import { type CabInfo } from "../state/event.slice";
import type { AppState } from "../state/store";
import {
  JazzDrawing,
  JazzConfig,
  JazzRoom,
  JazzPlayerAction,
  JazzPocketPick,
  JazzSubDrawing,
  JazzCab,
  JazzObsLabel,
} from "./schema";

// ---------------------------------------------------------------------------
// Instance types (loaded, non-null)
// ---------------------------------------------------------------------------

export type JazzRoomInstance = InstanceOfSchema<typeof JazzRoom>;
export type JazzDrawingInstance = InstanceOfSchema<typeof JazzDrawing>;
export type JazzConfigInstance = InstanceOfSchema<typeof JazzConfig>;
export type JazzPlayerActionInstance = InstanceOfSchema<typeof JazzPlayerAction>;
export type JazzPocketPickInstance = InstanceOfSchema<typeof JazzPocketPick>;
export type JazzSubDrawingInstance = InstanceOfSchema<typeof JazzSubDrawing>;
export type JazzCabInstance = InstanceOfSchema<typeof JazzCab>;
export type JazzObsLabelInstance = InstanceOfSchema<typeof JazzObsLabel>;

// ---------------------------------------------------------------------------
// Jazz → Redux types
// ---------------------------------------------------------------------------

export function jazzDrawingToDrawing(jd: JazzDrawingInstance): Drawing {
  // Cast to raw-access shapes for CoRecord iteration
  const raw = jd as unknown as {
    id: string;
    configId: string;
    metaJson: string;
    playerDisplayOrderJson: string;
    priorityPlayer?: number;
    winners: Record<string, number | null>;
    bans: Record<string, JazzPlayerActionInstance | null>;
    protects: Record<string, JazzPlayerActionInstance | null>;
    pocketPicks: Record<string, JazzPocketPickInstance | null>;
    subDrawings: Record<string, JazzSubDrawingInstance | null>;
  };

  const winners: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(raw.winners ?? {})) {
    if (v != null) winners[k] = v;
  }

  const bans: Record<string, PlayerActionOnChart | null> = {};
  for (const [k, v] of Object.entries(raw.bans ?? {})) {
    if (v != null) bans[k] = { player: v.player, chartId: v.chartId };
  }

  const protects: Record<string, PlayerActionOnChart | null> = {};
  for (const [k, v] of Object.entries(raw.protects ?? {})) {
    if (v != null) protects[k] = { player: v.player, chartId: v.chartId };
  }

  const pocketPicks: Record<string, PocketPick | null> = {};
  for (const [k, v] of Object.entries(raw.pocketPicks ?? {})) {
    if (v != null)
      pocketPicks[k] = {
        player: v.player,
        chartId: v.chartId,
        pick: JSON.parse(v.pickJson),
      };
  }

  const subDrawings: Record<string, SubDrawing> = {};
  for (const [k, v] of Object.entries(raw.subDrawings ?? {})) {
    if (v != null)
      subDrawings[k] = {
        compoundId: [v.parentId, v.subId],
        configId: v.configId,
        charts: JSON.parse(v.chartsJson),
      };
  }

  return {
    id: raw.id,
    configId: raw.configId,
    meta: JSON.parse(raw.metaJson),
    playerDisplayOrder: JSON.parse(raw.playerDisplayOrderJson),
    priorityPlayer: raw.priorityPlayer ?? undefined,
    winners,
    bans,
    protects,
    pocketPicks,
    subDrawings,
  };
}

export function jazzConfigToConfig(jc: JazzConfigInstance): ConfigState {
  return {
    id: jc.id,
    name: jc.name,
    gameKey: jc.gameKey,
    chartCount: jc.chartCount,
    playerPicks: jc.playerPicks,
    upperBound: jc.upperBound,
    lowerBound: jc.lowerBound,
    useWeights: jc.useWeights,
    orderByAction: jc.orderByAction,
    hideVetos: jc.hideVetos,
    weights: JSON.parse(jc.weightsJson),
    probabilityBucketCount: jc.probabilityBucketCount,
    forceDistribution: jc.forceDistribution,
    constrainPocketPicks: jc.constrainPocketPicks,
    style: jc.style,
    folders: JSON.parse(jc.foldersJson),
    difficulties: JSON.parse(jc.difficultiesJson),
    flags: JSON.parse(jc.flagsJson),
    cutoffDate: jc.cutoffDate,
    defaultPlayersPerDraw: jc.defaultPlayersPerDraw,
    sortByLevel: jc.sortByLevel,
    useGranularLevels: jc.useGranularLevels,
    multiDraws: jc.multiDrawsJson ? JSON.parse(jc.multiDrawsJson) : undefined,
  };
}

const DEFAULT_OBS_CSS = `h1 {
  /* add text styles here */
}`;

/**
 * Convert a loaded JazzRoom to a partial AppState for `receivePartyState`.
 * Only the three persisted slices are populated; local-only state is untouched.
 */
export function jazzRoomToAppState(room: JazzRoomInstance): Partial<AppState> {
  const drawings = ((room.drawings as unknown as JazzDrawingInstance[]) ?? [])
    .filter(Boolean)
    .map(jazzDrawingToDrawing);

  const configs = ((room.configs as unknown as JazzConfigInstance[]) ?? [])
    .filter(Boolean)
    .map(jazzConfigToConfig);

  // cabs: CoRecord<string, JazzCab> → Record<string, CabInfo>
  const cabsRec =
    (room.cabs as unknown as Record<string, JazzCabInstance | null>) ?? {};
  const cabs: Record<string, CabInfo> = {};
  for (const [k, v] of Object.entries(cabsRec)) {
    if (v != null) {
      cabs[k] = {
        id: v.id,
        name: v.name,
        activeMatch: v.activeMatchJson ? JSON.parse(v.activeMatchJson) : null,
      };
    }
  }
  // Guarantee at least the default cab when the room was just created
  if (Object.keys(cabs).length === 0) {
    cabs.default = { id: "default", name: "Primary Cab", activeMatch: null };
  }

  // obsLabels: CoRecord<string, JazzObsLabel> → Record<string, { label, value }>
  const labelsRec =
    (room.obsLabels as unknown as Record<
      string,
      JazzObsLabelInstance | null
    >) ?? {};
  const obsLabels: Record<string, { label: string; value: string }> = {};
  for (const [k, v] of Object.entries(labelsRec)) {
    if (v != null) obsLabels[k] = { label: v.label, value: v.value };
  }

  return {
    drawings: {
      ids: drawings.map((d) => d.id),
      entities: Object.fromEntries(drawings.map((d) => [d.id, d])),
    },
    config: {
      ids: configs.map((c) => c.id),
      entities: Object.fromEntries(configs.map((c) => [c.id, c])),
    },
    event: {
      eventName: room.eventName,
      cabs,
      obsLabels,
      obsCss: (room.obsCss as string) || DEFAULT_OBS_CSS,
    },
  };
}

// ---------------------------------------------------------------------------
// Redux types → Jazz init objects
// ---------------------------------------------------------------------------

/**
 * Scalar / JSON fields only — CoRecord fields (winners, bans, protects,
 * pocketPicks, subDrawings) must be created as separate CoValues and passed
 * directly to JazzDrawing.create() in room-mutations.ts.
 */
export function drawingScalarInit(drawing: Drawing) {
  return {
    id: drawing.id,
    configId: drawing.configId,
    metaJson: JSON.stringify(drawing.meta),
    playerDisplayOrderJson: JSON.stringify(drawing.playerDisplayOrder),
    priorityPlayer: drawing.priorityPlayer,
  };
}

export function configToJazzInit(config: ConfigState) {
  return {
    id: config.id,
    name: config.name,
    gameKey: config.gameKey,
    chartCount: config.chartCount,
    playerPicks: config.playerPicks,
    upperBound: config.upperBound,
    lowerBound: config.lowerBound,
    useWeights: config.useWeights,
    orderByAction: config.orderByAction,
    hideVetos: config.hideVetos,
    weightsJson: JSON.stringify(config.weights),
    probabilityBucketCount: config.probabilityBucketCount,
    forceDistribution: config.forceDistribution,
    constrainPocketPicks: config.constrainPocketPicks,
    style: config.style,
    foldersJson: JSON.stringify(config.folders),
    difficultiesJson: JSON.stringify(config.difficulties),
    flagsJson: JSON.stringify(config.flags),
    cutoffDate: config.cutoffDate,
    defaultPlayersPerDraw: config.defaultPlayersPerDraw,
    sortByLevel: config.sortByLevel,
    useGranularLevels: config.useGranularLevels,
    multiDrawsJson: config.multiDraws
      ? JSON.stringify(config.multiDraws)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findJazzDrawing(
  room: JazzRoomInstance,
  drawingId: string,
): JazzDrawingInstance | undefined {
  const list = room.drawings as unknown as JazzDrawingInstance[];
  return list?.find((jd) => jd?.id === drawingId) ?? undefined;
}

export function findJazzConfig(
  room: JazzRoomInstance,
  configId: string,
): JazzConfigInstance | undefined {
  const list = room.configs as unknown as JazzConfigInstance[];
  return list?.find((jc) => jc?.id === configId) ?? undefined;
}

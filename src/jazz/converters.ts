/**
 * Jazz ↔ Redux type converters
 *
 * Converts between the existing TypeScript types used by Redux slices and the
 * Jazz CoValue instances.  Used by the sync manager to populate Redux state
 * from Jazz (initial load + remote updates) and by room-mutations to apply
 * Redux actions back to Jazz.
 */

import type { InstanceOfSchema } from "jazz-tools";
import { type Drawing, type SubDrawing } from "../models/Drawing";
import { type ConfigState } from "../state/config.slice";
import type { AppState } from "../state/store";
import { JazzDrawing, JazzConfig, JazzRoom } from "./schema";

// ---------------------------------------------------------------------------
// Instance types (loaded, non-null)
// ---------------------------------------------------------------------------

export type JazzRoomInstance = InstanceOfSchema<typeof JazzRoom>;
export type JazzDrawingInstance = InstanceOfSchema<typeof JazzDrawing>;
export type JazzConfigInstance = InstanceOfSchema<typeof JazzConfig>;

// ---------------------------------------------------------------------------
// Jazz → Redux types
// ---------------------------------------------------------------------------

export function jazzDrawingToDrawing(jd: JazzDrawingInstance): Drawing {
  return {
    id: jd.id,
    configId: jd.configId,
    meta: JSON.parse(jd.metaJson),
    playerDisplayOrder: JSON.parse(jd.playerDisplayOrderJson),
    winners: JSON.parse(jd.winnersJson),
    bans: JSON.parse(jd.bansJson),
    protects: JSON.parse(jd.protectsJson),
    pocketPicks: JSON.parse(jd.pocketPicksJson),
    priorityPlayer: jd.priorityPlayer ?? undefined,
    subDrawings: JSON.parse(jd.subDrawingsJson),
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

const DEFAULT_CABS_JSON = JSON.stringify({
  default: { id: "default", name: "Primary Cab", activeMatch: null },
});

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
      cabs: JSON.parse((room.cabsJson as string) || DEFAULT_CABS_JSON),
      obsLabels: JSON.parse((room.obsLabelsJson as string) || "{}"),
      obsCss: (room.obsCss as string) || DEFAULT_OBS_CSS,
    },
  };
}

// ---------------------------------------------------------------------------
// Redux types → Jazz init objects (used in JazzXxx.create() calls)
// ---------------------------------------------------------------------------

export function drawingToJazzInit(drawing: Drawing) {
  return {
    id: drawing.id,
    configId: drawing.configId,
    metaJson: JSON.stringify(drawing.meta),
    playerDisplayOrderJson: JSON.stringify(drawing.playerDisplayOrder),
    winnersJson: JSON.stringify(drawing.winners),
    bansJson: JSON.stringify(drawing.bans),
    protectsJson: JSON.stringify(drawing.protects),
    pocketPicksJson: JSON.stringify(drawing.pocketPicks),
    priorityPlayer: drawing.priorityPlayer,
    subDrawingsJson: JSON.stringify(drawing.subDrawings),
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

// ---------------------------------------------------------------------------
// JSON-field mutation helper
// ---------------------------------------------------------------------------

/**
 * Read → parse → mutate → stringify → write a JSON string field on a JazzDrawing.
 * Uses `$jazz.set()` which is the correct Jazz CoMap mutation API.
 */
export function mutateDrawingJson(
  jd: JazzDrawingInstance,
  key: "winnersJson" | "bansJson" | "protectsJson" | "pocketPicksJson" | "subDrawingsJson" | "metaJson" | "playerDisplayOrderJson",
  mutate: (value: ReturnType<typeof JSON.parse>) => unknown,
) {
  const current = JSON.parse((jd as unknown as Record<string, string>)[key] ?? "{}");
  const next = mutate(current);
  // $jazz.set() is the documented Jazz API for CoMap mutations
  (jd.$jazz as { set(key: string, value: string): void }).set(
    key,
    JSON.stringify(next),
  );
}

export function mutateRoomJson(
  room: JazzRoomInstance,
  key: "cabsJson" | "obsLabelsJson",
  mutate: (value: ReturnType<typeof JSON.parse>) => unknown,
) {
  const current = JSON.parse((room as unknown as Record<string, string>)[key] ?? "{}");
  const next = mutate(current);
  (room.$jazz as { set(key: string, value: string): void }).set(
    key,
    JSON.stringify(next),
  );
}

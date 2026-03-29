/**
 * Jazz DB Schema - DDR Card Draw
 *
 * Design notes:
 * - Per-chart CRDT fields (winners, bans, protects, pocketPicks) are CoRecords
 *   so concurrent updates from different clients merge at the chart-ID level.
 * - subDrawings is a CoRecord of JazzSubDrawing CoMaps — adding/removing
 *   sub-draws doesn't conflict even under concurrency.
 * - chartsJson inside JazzSubDrawing stays as JSON: charts are replaced
 *   atomically on redraw, never edited field-by-field.
 * - Config scalar fields and complex union fields (meta, playerDisplayOrder,
 *   weights, etc.) remain JSON strings — they are set atomically.
 * - cabs and obsLabels are CoRecords so individual cab/label edits don't
 *   conflict with each other.
 */

import { co, z } from "jazz-tools";

// ---------------------------------------------------------------------------
// Nested drawing types
// ---------------------------------------------------------------------------

/**
 * A ban or protect action tied to a chart.
 * Stored as a CoMap so concurrent ban + protect on different charts never
 * conflict (one CoMap per chart entry in the parent CoRecord).
 */
export const JazzPlayerAction = co.map({
  player: z.number(),
  chartId: z.string(),
});

/** Record<chartId, JazzPlayerAction> — used for both bans and protects. */
export const JazzPlayerActionRecord = co.record(z.string(), JazzPlayerAction);

/**
 * Record<chartId, playerIndex> — absence of a key means no winner yet.
 * Using a primitive CoRecord (number values) for maximum simplicity.
 */
export const JazzWinnersRecord = co.record(z.string(), z.number());

/**
 * A pocket pick: the picking player, the target chart, and the chosen chart
 * (stored as JSON because EligibleChart is a large complex union type that is
 * always set atomically).
 */
export const JazzPocketPick = co.map({
  player: z.number(),
  chartId: z.string(),
  /** JSON-serialised EligibleChart */
  pickJson: z.string(),
});

/** Record<chartId, JazzPocketPick> */
export const JazzPocketPickRecord = co.record(z.string(), JazzPocketPick);

/**
 * A single sub-drawing (set) within a match.
 * chartsJson is replaced atomically on redraw — there is no benefit to making
 * the charts array a CoList because the whole array is always regenerated.
 */
export const JazzSubDrawing = co.map({
  /** components of CompoundSetId */
  parentId: z.string(),
  subId: z.string(),
  configId: z.string(),
  /** JSON: Array<DrawnChart | PlayerPickPlaceholder> */
  chartsJson: z.string(),
});

/** Record<subId, JazzSubDrawing> */
export const JazzSubDrawingRecord = co.record(z.string(), JazzSubDrawing);

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * One Drawing (match).  The per-chart action records (winners, bans, protects,
 * pocketPicks) and the subDrawings record are all CoValues so that concurrent
 * edits from different browser clients (e.g. operator marking a ban while the
 * bracket runner updates the protect) merge without conflicts.
 */
export const JazzDrawing = co.map({
  /** Stable ID, mirrors Drawing.id */
  id: z.string(),
  configId: z.string(),
  /** JSON: SimpleMeta | StartggVersusMeta | StartggGauntletMeta (set once) */
  metaJson: z.string(),
  /** JSON: number[] — player display order (rarely changed, set atomically) */
  playerDisplayOrderJson: z.string(),
  priorityPlayer: z.number().optional(),
  /** chartId → winning player index; absence = no winner */
  winners: JazzWinnersRecord,
  /** chartId → PlayerActionOnChart */
  bans: JazzPlayerActionRecord,
  /** chartId → PlayerActionOnChart */
  protects: JazzPlayerActionRecord,
  /** chartId → PocketPick */
  pocketPicks: JazzPocketPickRecord,
  /** subId → SubDrawing */
  subDrawings: JazzSubDrawingRecord,
});

export const JazzDrawingList = co.list(JazzDrawing);

// ---------------------------------------------------------------------------
// Config (array fields kept as JSON — set atomically, not edited per-element)
// ---------------------------------------------------------------------------

export const JazzConfig = co.map({
  id: z.string(),
  name: z.string(),
  gameKey: z.string(),
  chartCount: z.number(),
  playerPicks: z.number(),
  upperBound: z.number(),
  lowerBound: z.number(),
  useWeights: z.boolean(),
  orderByAction: z.boolean(),
  hideVetos: z.boolean(),
  /** JSON: Array<number | undefined> */
  weightsJson: z.string(),
  probabilityBucketCount: z.number().nullable(),
  forceDistribution: z.boolean(),
  constrainPocketPicks: z.boolean(),
  style: z.string(),
  /** JSON: string[] */
  foldersJson: z.string(),
  /** JSON: string[] */
  difficultiesJson: z.string(),
  /** JSON: string[] */
  flagsJson: z.string(),
  cutoffDate: z.string(),
  defaultPlayersPerDraw: z.number(),
  sortByLevel: z.boolean(),
  useGranularLevels: z.boolean(),
  /** JSON: { merge: boolean; configs: string[] } | undefined */
  multiDrawsJson: z.string().optional(),
});

export const JazzConfigList = co.list(JazzConfig);

// ---------------------------------------------------------------------------
// Event-level nested types
// ---------------------------------------------------------------------------

/**
 * One arcade cabinet / station.
 * activeMatchJson stores a CompoundSetId tuple, a plain string match ID, or
 * null as JSON (the union type makes a z.string().nullable() cleaner here).
 */
export const JazzCab = co.map({
  id: z.string(),
  name: z.string(),
  /** JSON: CompoundSetId | string | null */
  activeMatchJson: z.string().nullable(),
});

/** Record<cabId, JazzCab> */
export const JazzCabRecord = co.record(z.string(), JazzCab);

/** An OBS text overlay label: a human label string and its current value. */
export const JazzObsLabel = co.map({
  label: z.string(),
  value: z.string(),
});

/** Record<labelId, JazzObsLabel> */
export const JazzObsLabelRecord = co.record(z.string(), JazzObsLabel);

// ---------------------------------------------------------------------------
// Event Room
// ---------------------------------------------------------------------------

/**
 * Top-level collaborative room for a tournament event.
 *
 * Replaces both the Redux store (drawings + config + event slices) AND the
 * PartyKit server/client WebSocket layer.  Any client that loads this CoValue
 * by its ID gets live CRDT-synced updates from all connected clients via Jazz.
 */
export const JazzRoom = co.map({
  eventName: z.string(),
  obsCss: z.string(),
  drawings: JazzDrawingList,
  configs: JazzConfigList,
  cabs: JazzCabRecord,
  obsLabels: JazzObsLabelRecord,
});

// ---------------------------------------------------------------------------
// Account (minimal — guest / anonymous mode)
// ---------------------------------------------------------------------------

export const AppAccount = co.account({
  root: co.map({}),
  profile: co.profile(),
});

export type AppAccountType = typeof AppAccount;
export type JazzRoomType = typeof JazzRoom;
export type JazzDrawingType = typeof JazzDrawing;
export type JazzConfigType = typeof JazzConfig;

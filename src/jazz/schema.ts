/**
 * Jazz DB Schema - DDR Card Draw
 *
 * This file defines the collaborative CoValue types that replace the combined
 * Redux state (drawings, configs, event) + PartyKit real-time sync layer.
 *
 * Design notes:
 * - Each Drawing is a CoMap, so concurrent edits from multiple clients
 *   (e.g. P1 marks a ban while P2 marks a protect) merge without conflicts.
 * - Complex union / array fields (charts, meta) are JSON-serialised strings
 *   because they are replaced atomically and don't need sub-field CRDT merging.
 *   A production version could replace these with nested CoLists/CoMaps for
 *   even finer-grained conflict resolution.
 * - The top-level JazzRoom owns everything; it lives in a Group with public
 *   writer access so any browser that knows the Jazz ID can collaborate.
 */

import { co, z } from "jazz-tools";

// ---------------------------------------------------------------------------
// Drawings
// ---------------------------------------------------------------------------

/**
 * A single Drawing (match) in the tournament.
 *
 * Most fields that are mutable during a match (winners, bans, protects,
 * pocketPicks) are stored as separate top-level keys so that concurrent
 * writes from different clients can be merged field-by-field.
 *
 * `subDrawingsJson` contains the full Record<string, SubDrawing> including
 * the chart arrays; it is replaced wholesale on redraw operations.
 */
export const JazzDrawing = co.map({
  /** Stable ID, mirrors Drawing.id */
  id: z.string(),
  configId: z.string(),
  /** JSON: SimpleMeta | StartggVersusMeta | StartggGauntletMeta */
  metaJson: z.string(),
  /** JSON: number[] — index order for player display */
  playerDisplayOrderJson: z.string(),
  /** JSON: Record<string, number | null> — chartId → winning player index */
  winnersJson: z.string(),
  /** JSON: Record<string, PlayerActionOnChart | null> */
  bansJson: z.string(),
  /** JSON: Record<string, PlayerActionOnChart | null> */
  protectsJson: z.string(),
  /** JSON: Record<string, PocketPick | null> */
  pocketPicksJson: z.string(),
  /** Optional priority player index */
  priorityPlayer: z.number().optional(),
  /**
   * JSON: Record<string, SubDrawing>
   * Each SubDrawing contains { compoundId, configId, charts[] }.
   * Charts are complex union objects (DrawnChart | PlayerPickPlaceholder)
   * so we serialise the whole record.
   */
  subDrawingsJson: z.string(),
});

export const JazzDrawingList = co.list(JazzDrawing);

// ---------------------------------------------------------------------------
// Configs
// ---------------------------------------------------------------------------

/**
 * A draw configuration (game, chart count, difficulty range, etc.).
 * Array fields (weights, folders, difficulties, flags) are JSON-serialised.
 */
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
  /** JSON: { merge: boolean; configs: string[] } | undefined — omitted when not set */
  multiDrawsJson: z.string().optional(),
});

export const JazzConfigList = co.list(JazzConfig);

// ---------------------------------------------------------------------------
// Event Room
// ---------------------------------------------------------------------------

/**
 * The top-level collaborative room for a tournament event.
 *
 * Replaces both the Redux store (drawings + config + event slices) AND the
 * PartyKit server/client WebSocket layer.  Any client that loads this CoValue
 * by its ID gets live CRDT-synced updates from all other connected clients
 * automatically via Jazz Cloud.
 *
 * Cab management and OBS labels are low-cardinality records stored as JSON.
 * In production they could each be their own CoRecord for finer granularity.
 */
export const JazzRoom = co.map({
  eventName: z.string(),
  /** JSON: Record<string, CabInfo> — arcade-machine assignments */
  cabsJson: z.string(),
  /** JSON: Record<string, { label: string; value: string }> */
  obsLabelsJson: z.string(),
  obsCss: z.string(),
  drawings: JazzDrawingList,
  configs: JazzConfigList,
});

// ---------------------------------------------------------------------------
// Account (minimal — we use guest / anonymous mode)
// ---------------------------------------------------------------------------

/**
 * Minimal account schema.  We don't require sign-in; the app runs in guest
 * mode so every browser session gets a persistent anonymous identity stored
 * in localStorage.  Room ownership is managed via a public Group so any
 * client with the Jazz room ID can read and write.
 */
export const AppAccount = co.account({
  root: co.map({}),
  profile: co.profile(),
});

export type AppAccountType = typeof AppAccount;
export type JazzRoomType = typeof JazzRoom;
export type JazzDrawingType = typeof JazzDrawing;
export type JazzConfigType = typeof JazzConfig;

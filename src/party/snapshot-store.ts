import type { AppState } from "../state/root-reducer";

/**
 * One durable copy of a room.
 *
 * State and sequencer metadata travel together in a single value on purpose.
 * They used to be two independent `storage.put` calls of very different sizes
 * (`currentState` ~170KB, `syncMeta` a few KB), which meant the small one kept
 * landing after the large one started failing: a restarted room came back
 * knowing the *seq* and dedupe ids of actions whose effects it had lost. A
 * client re-sending one of those got an `ack` ("already applied") and stopped
 * trying, and `recentActionIds` told it to drop the pending action outright.
 * Writing them as one value means they fail together, so a stale snapshot is
 * at least an internally consistent one that clients can be repaired from.
 */
export interface RoomSnapshot {
  /** seq of the last action baked into `state` */
  seq: number;
  /** ids of the actions behind `state`, for cross-restart dedupe */
  seenIds: string[];
  state: AppState;
  /** ISO timestamp, for operator forensics rather than any logic */
  savedAt: string;
}

export function isRoomSnapshot(value: unknown): value is RoomSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<RoomSnapshot>;
  return (
    typeof candidate.seq === "number" &&
    Array.isArray(candidate.seenIds) &&
    !!candidate.state &&
    typeof candidate.state === "object"
  );
}

/** a place a {@link RoomSnapshot} can be kept, keyed by room id */
export interface SnapshotStore {
  /** short human-readable identity, for logs and the `?debug` payload */
  readonly describe: string;
  put(roomId: string, snapshot: RoomSnapshot): Promise<void>;
  get(roomId: string): Promise<RoomSnapshot | undefined>;
}

/**
 * Where one room's snapshot lives in the bucket. Unchanged from the partykit
 * deploy, which wrote the same keys over the S3 API: that is what lets rooms
 * saved before the move to Workers hydrate from this store.
 */
function objectKey(roomId: string) {
  return `rooms/${encodeURIComponent(roomId)}/snapshot.json`;
}

/**
 * R2 through the Workers binding. Stays plain JSON rather than gzip so an
 * object can be read with `wrangler r2 object get` during an incident.
 *
 * `wrangler dev` simulates the binding on disk under `.wrangler/state`, so
 * local development runs this exact code path with no credentials.
 */
export function getR2SnapshotStore(bucket: R2Bucket): SnapshotStore {
  return {
    describe: "r2://SNAPSHOTS",

    async put(roomId, snapshot) {
      await bucket.put(objectKey(roomId), JSON.stringify(snapshot), {
        httpMetadata: { contentType: "application/json" },
      });
    },

    async get(roomId) {
      const object = await bucket.get(objectKey(roomId));
      if (!object) return undefined;
      const parsed: unknown = await object.json();
      if (!isRoomSnapshot(parsed)) {
        throw new Error("R2 object is not a recognizable RoomSnapshot");
      }
      return parsed;
    },
  };
}

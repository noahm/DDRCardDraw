import { AwsClient } from "aws4fetch";
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

/** every env var that must be present for the R2 store to be usable */
const R2_ENV = [
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

/** origin of a local snapshot server, which enables the local store when set */
const LOCAL_ENV = "LOCAL_SNAPSHOT_URL";

/** which of {@link R2_ENV} are absent, so logs can name what to go set */
function missingR2Env(): string[] {
  return R2_ENV.filter((name) => !process.env[name]);
}

/**
 * Where one room's snapshot lives, shared by both stores on purpose: the local
 * folder mirrors the bucket layout, so a snapshot can be moved between them by
 * copying a file and the two stores stay one implementation apart.
 */
function objectKey(roomId: string) {
  return `rooms/${encodeURIComponent(roomId)}/snapshot.json`;
}

/**
 * R2 over its S3-compatible endpoint, reached with a signed `fetch` rather
 * than a Workers binding.
 *
 * PartyKit's hosted runtime cannot bind Cloudflare resources (binding support
 * on the deploy-to-your-own-account path is still unreleased), so a signed
 * HTTPS request is the only way to reach R2 from here today. Ejecting to
 * `partyserver` on Workers later replaces the `AwsClient` with
 * `env.SNAPSHOTS.put(...)` and deletes the signing — the surrounding logic,
 * and the object layout, carry over unchanged.
 *
 * Returns undefined when the credentials aren't configured, which is the
 * normal state in development and before the secrets are set in production.
 * {@link getSnapshotStore} decides what happens then.
 */
export function getR2SnapshotStore(): SnapshotStore | undefined {
  if (missingR2Env().length) return;

  const accountId = process.env.R2_ACCOUNT_ID as string;
  const bucket = process.env.R2_BUCKET as string;
  const client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    service: "s3",
    region: "auto",
  });
  const origin = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;

  async function failure(res: Response, what: string): Promise<Error> {
    // R2 reports failures as an XML body; keep a slice of it so a
    // misconfigured token or bucket is diagnosable from the logs alone
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      detail = "<unreadable body>";
    }
    return new Error(`R2 ${what} failed: ${res.status} ${detail}`);
  }

  return {
    describe: `r2://${bucket}`,

    async put(roomId, snapshot) {
      const res = await client.fetch(`${origin}/${objectKey(roomId)}`, {
        method: "PUT",
        body: JSON.stringify(snapshot),
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) throw await failure(res, "put");
      // the body is empty on success, but leaving it undrained keeps the
      // connection from being reused
      await res.arrayBuffer();
    },

    async get(roomId) {
      const res = await client.fetch(`${origin}/${objectKey(roomId)}`);
      if (res.status === 404) return undefined;
      if (!res.ok) throw await failure(res, "get");
      const parsed: unknown = await res.json();
      if (!isRoomSnapshot(parsed)) {
        throw new Error("R2 object is not a recognizable RoomSnapshot");
      }
      return parsed;
    },
  };
}

/**
 * The same object layout kept on the developer's own disk, reached through
 * `scripts/local-snapshot-store.mjs`.
 *
 * It is an HTTP hop rather than a file write because `partykit dev` runs this
 * code inside workerd, which has no filesystem — so a local store has to live
 * in a process that does, and the only way to reach it is the same `fetch`
 * that reaches R2. What that buys is the point: the two-target durability
 * path, the coalescing, the hydration comparison and the `?debug` reporting
 * all run locally, against a folder you can `cat`, with no Cloudflare account
 * and no credentials anywhere.
 *
 * Returns undefined unless `LOCAL_SNAPSHOT_URL` is set, so it can never be
 * reached by a deploy that didn't ask for it.
 */
export function getLocalSnapshotStore(): SnapshotStore | undefined {
  const configured = process.env[LOCAL_ENV];
  if (!configured) return;

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    console.log(`${LOCAL_ENV} is not a URL, ignoring it: ${configured}`);
    return;
  }
  // normalized so a trailing slash in `.env` can't produce a `//` path
  const origin = url.origin;

  async function failure(res: Response, what: string): Promise<Error> {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      detail = "<unreadable body>";
    }
    return new Error(`local snapshot ${what} failed: ${res.status} ${detail}`);
  }

  return {
    describe: `local://${url.host}`,

    async put(roomId, snapshot) {
      const res = await fetch(`${origin}/${objectKey(roomId)}`, {
        method: "PUT",
        body: JSON.stringify(snapshot),
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) throw await failure(res, "put");
      await res.arrayBuffer();
    },

    async get(roomId) {
      const res = await fetch(`${origin}/${objectKey(roomId)}`);
      if (res.status === 404) {
        // drain the explanatory body; a fresh room has no snapshot yet
        await res.arrayBuffer();
        return undefined;
      }
      if (!res.ok) throw await failure(res, "get");
      const parsed: unknown = await res.json();
      if (!isRoomSnapshot(parsed)) {
        throw new Error(
          "local snapshot file is not a recognizable RoomSnapshot",
        );
      }
      return parsed;
    },
  };
}

/**
 * The off-storage snapshot target this server should use, or undefined to run
 * on partykit room storage alone.
 *
 * R2 wins when it is fully configured, so a deploy that has credentials can
 * never be quietly downgraded to a developer's laptop by a stray variable.
 * Everything downstream — writes, hydration, `?debug` — only knows it has a
 * `SnapshotStore`, which is what lets local mode exercise the real code path
 * rather than a bypass of it.
 */
export function getSnapshotStore(): SnapshotStore | undefined {
  const r2 = getR2SnapshotStore();
  if (r2) {
    console.log(`snapshot store: ${r2.describe}`);
    return r2;
  }

  const missing = missingR2Env().join(", ");
  const local = getLocalSnapshotStore();
  if (local) {
    console.log(
      `snapshot store: ${local.describe} (R2 env missing: ${missing})`,
    );
    return local;
  }

  console.log(
    `no snapshot store; missing env: ${missing}. Set ${LOCAL_ENV} to keep snapshots on disk instead — see .env.template.`,
  );
  return;
}

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
 * The room then runs on room storage alone, exactly as it does today.
 */
export function getR2SnapshotStore(): SnapshotStore | undefined {
  const missing = R2_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    console.log(
      `R2 snapshot store disabled; missing env: ${missing.join(", ")}`,
    );
    return;
  }

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

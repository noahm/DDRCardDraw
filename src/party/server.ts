import {
  Server,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from "partyserver";
import type {
  ActionAck,
  ActionReject,
  CatchupRequest,
  CatchupResponse,
  ClientMessage,
  Persisted,
  Ping,
  Pong,
  ReduxAction,
  Roomstate,
  StampedAction,
} from "./types";
import { configureStore } from "@reduxjs/toolkit";
import { reducer } from "../state/root-reducer";
import type { AppState } from "../state/store";

import {
  getR2SnapshotStore,
  isRoomSnapshot,
  type RoomSnapshot,
  type SnapshotStore,
} from "./snapshot-store";
import { applyMigrations } from "../state/migrations";
import { gunzipJson, gzipJson } from "./compression";

/** upper bound on remembered action ids used to dedupe client re-sends */
const MAX_REMEMBERED_ACTIONS = 1000;
/** how many recent stamped actions to retain for incremental catch-up */
const MAX_TAIL = 500;

/** storage key holding the room snapshot: state and sequencer metadata as one value */
const SNAPSHOT_KEY = "snapshot";
/**
 * storage key holding the seq of the last snapshot confirmed written to the
 * remote store, so a wake can skip reading R2 when room storage is current
 */
const REMOTE_SEQ_KEY = "remoteSeq";
/**
 * SQLite-backed Durable Object storage refuses any key + value pair larger
 * than this (2 MB). PartyKit's storage capped values at 131072 bytes, which is
 * what the compression below was originally sized against.
 */
const STORAGE_VALUE_LIMIT = 2 * 1000 * 1000;
/** fraction of the limit a stored snapshot may reach before `?debug` complains */
const STORAGE_WARN_AT = 0.8;

/**
 * Minimum spacing between remote snapshot writes. Room storage is in-process
 * and cheap enough to write on every action; the remote store is an HTTP round
 * trip either way, so writes coalesce and always carry the latest snapshot
 * rather than queueing one per action.
 */
const REMOTE_WRITE_INTERVAL_MS = 2000;
/** delay before retrying a failed remote write, so a dead bucket isn't hammered */
const REMOTE_RETRY_INTERVAL_MS = 30_000;

/**
 * Heartbeat frames, byte for byte as the client sends them. The runtime
 * answers these itself (see `onStart`), so idle rooms can hibernate through
 * the client's 10s heartbeat instead of waking for every ping.
 */
const PING_FRAME = JSON.stringify(<Ping>{ type: "ping" });
const PONG_FRAME = JSON.stringify(<Pong>{ type: "pong" });

/** minimum spacing between `persisted` broadcasts, to keep them off the hot path */
const PERSISTED_BROADCAST_INTERVAL_MS = 1000;

/**
 * greppable prefix shared by every diagnostic line this server emits. Filter
 * production logs with this to trace a room's persisted-snapshot lifecycle.
 */
const LOG_PREFIX = "[party-diag]";

/**
 * Cheap, side-effect-free fingerprint of the shared state so snapshots can be
 * compared to see whether the persisted state advanced. Uses the drawings
 * entity count plus the serialized length as a poor-man's hash; this is for
 * observability only and never feeds back into state.
 */
function fingerprintParts(state: AppState) {
  const drawings = state.drawings?.ids?.length ?? 0;
  let stateLen = -1;
  try {
    stateLen = JSON.stringify(state).length;
  } catch {
    stateLen = -1;
  }
  return { drawings, stateLen };
}

function formatFingerprint(parts: { drawings: number; stateLen: number }) {
  return `drawings=${parts.drawings} stateLen=${parts.stateLen}`;
}

function stateFingerprint(state: AppState): string {
  return formatFingerprint(fingerprintParts(state));
}

/** shape of the `?debug` snapshot for one persistence target */
interface SnapshotInfo {
  present: boolean;
  fingerprint?: string;
  drawings?: number;
  stateLen?: number;
  seq?: number;
  savedAt?: string;
  /** bytes actually occupied — what the room storage value limit measures */
  storedBytes?: number;
  compressed?: boolean;
  matchesMemory?: boolean;
  error?: string;
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

/** running tally of one persistence target's writes, for `?debug` */
interface WriteTally {
  started: number;
  ok: number;
  failed: number;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

function newTally(): WriteTally {
  return {
    started: 0,
    ok: 0,
    failed: 0,
    lastOkAt: null,
    lastErrorAt: null,
    lastError: null,
  };
}

/**
 * One event room. partyserver routes `/parties/main/<room>` to the Durable
 * Object named `<room>` of this class (see `wrangler.jsonc` and `worker.ts`).
 *
 * Hibernation is on: an idle room is evicted from memory while its sockets
 * stay connected, and the next message, request or alarm re-runs `onStart`
 * against a fresh instance. So nothing a live client may depend on can be
 * memory-only. The snapshot (state, seq, dedupe ids) is in room storage, the
 * catch-up tail is a SQLite table, and the owed remote write is an alarm.
 * Instance fields below are either rebuilt by `onStart` or are diagnostics
 * that describe the current wake only.
 */
export class Main extends Server<Env> {
  static options = { hibernate: true };

  /** assigned in onStart, which partyserver awaits before any request or socket */
  private store!: ReturnType<typeof configureStore<AppState>>;

  /**
   * The durable copy kept outside room storage: the R2 bucket bound as
   * `SNAPSHOTS`, real in production and simulated on disk by `wrangler dev`.
   */
  private remoteStore: SnapshotStore | undefined = this.env.SNAPSHOTS
    ? getR2SnapshotStore(this.env.SNAPSHOTS)
    : undefined;

  /** monotonic counter assigning the canonical order of applied actions */
  private seq = 0;

  /** recently applied action ids mapped to their seq, oldest first */
  private seenActionIds = new Map<string, number>();

  /**
   * highest seq confirmed written to at least one durable store. Trails `seq`
   * whenever persistence is failing, which is the whole point: clients watch
   * the gap and warn rather than discovering it at the next restart.
   */
  private persistedSeq = 0;

  // ---- diagnostics, reported by `GET ...?debug`. In-memory only: they
  // describe the *current* room instance and reset when it is evicted.

  private instanceStartedAt = Date.now();

  /** how this instance's state was hydrated at startup */
  private hydration: {
    source: "storage" | "remote" | "fresh";
    at: string;
    seq: number;
    fingerprint: string | null;
    /** what each candidate offered, so a wrong pick is visible after the fact */
    candidates: { storage: number | null; remote: number | null };
    /** false when room storage was known to be current and R2 went unread */
    remoteRead: boolean;
    error: string | null;
  } | null = null;

  private storageWrites = newTally();
  private remoteWrites = newTally();

  /** latest snapshot awaiting a room storage write, replaced rather than queued */
  private localPending: { snapshot: RoomSnapshot; fingerprint: string } | null =
    null;
  private localFlushing = false;
  /** compressed size of the last snapshot written, what the limit measures */
  private storedBytes: number | null = null;

  /**
   * whether this instance already armed the alarm that carries the next
   * remote write. Only a hint to skip redundant `setAlarm` calls: the alarm
   * itself is the durable record that a remote write is owed.
   */
  private remoteAlarmArmed = false;

  private lastPersistedBroadcastAt = 0;

  private lastAction: { type: string; seq: number; at: string } | null = null;

  private lastError: { at: string; where: string; message: string } | null =
    null;

  private recordError(where: string, e: unknown) {
    this.lastError = {
      at: new Date().toISOString(),
      where,
      message: describeError(e),
    };
  }

  /** emit a single greppable diagnostic line tagged with this room's id */
  private log(event: string, details = "") {
    console.log(
      `${LOG_PREFIX} room=${this.name} ${event}${details ? ` ${details}` : ""}`,
    );
  }

  /** current count of live connections, for correlating socket cycles */
  private connectionCount(): number {
    return [...this.getConnections()].length;
  }

  async onStart() {
    const hydrateErrors: string[] = [];

    // Answered by the runtime without waking the room. Set on every start
    // because it is per-instance configuration, not stored state.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(PING_FRAME, PONG_FRAME),
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS tail (seq INTEGER PRIMARY KEY, action TEXT NOT NULL)",
    );

    const local = await this.readLocalSnapshot().catch((e: unknown) => {
      hydrateErrors.push(`storage: ${describeError(e)}`);
      this.recordError("onStart:storage", e);
      console.error(`${LOG_PREFIX} room=${this.name} onStart:storage`, e);
      return undefined;
    });

    // Take whichever durable copy is further along, rather than trusting room
    // storage just because it answered: room storage has a value size limit
    // and R2 does not, so R2 can be the one still advancing. It is also how
    // rooms saved by the partykit deploy come back: their Durable Object
    // storage starts empty here, and R2 still holds their snapshot.
    //
    // A hibernating room runs this on every wake, though, so R2 is only read
    // when it might be ahead: room storage is empty, or the last remote write
    // this room confirmed is newer than what room storage holds.
    const remoteSeq = await this.ctx.storage
      .get<number>(REMOTE_SEQ_KEY)
      .catch((): undefined => undefined);
    const remoteRead =
      !local || remoteSeq === undefined || remoteSeq > local.seq;
    const remote = remoteRead
      ? await this.readRemoteSnapshot().catch((e: unknown) => {
          hydrateErrors.push(`remote: ${describeError(e)}`);
          this.recordError("onStart:remote", e);
          console.error(`${LOG_PREFIX} room=${this.name} onStart:remote`, e);
          return undefined;
        })
      : undefined;
    if (remoteRead && !hydrateErrors.some((e) => e.startsWith("remote:"))) {
      // record what R2 held so later wakes can skip it until it moves again;
      // rooms from before this key existed get it on their first wake
      await this.ctx.storage
        .put(REMOTE_SEQ_KEY, remote?.seq ?? 0)
        .catch((e: unknown) => this.recordError("onStart:remoteSeq", e));
    }

    let source: "storage" | "remote" | "fresh" = "fresh";
    let chosen: RoomSnapshot | undefined;
    if (local && (!remote || local.seq >= remote.seq)) {
      chosen = local;
      source = "storage";
    } else if (remote) {
      chosen = remote;
      source = "remote";
    }

    if (chosen) {
      const snapshot = chosen;
      applyMigrations(snapshot.state);
      this.store = configureStore({ reducer, preloadedState: snapshot.state });
      this.seq = snapshot.seq;
      this.persistedSeq = snapshot.seq;
      this.seenActionIds = new Map(
        snapshot.seenIds.map((id) => [id, snapshot.seq] as const),
      );
    } else {
      this.store = configureStore({ reducer });
    }

    // The tail is written as each action is stamped, ahead of the snapshot
    // that covers it, so an eviction between the two leaves rows past the seq
    // we just restored. Those seqs will be reassigned; drop them. A snapshot
    // from anywhere but room storage shares no history with the table at all.
    if (source === "storage") {
      this.ctx.storage.sql.exec("DELETE FROM tail WHERE seq > ?", this.seq);
    } else {
      this.ctx.storage.sql.exec("DELETE FROM tail");
    }

    const fingerprint = stateFingerprint(this.store.getState());
    this.hydration = {
      source,
      at: new Date().toISOString(),
      seq: this.seq,
      fingerprint,
      candidates: {
        storage: local?.seq ?? null,
        remote: remote?.seq ?? null,
      },
      remoteRead,
      error: hydrateErrors.length ? hydrateErrors.join("; ") : null,
    };
    this.log(
      "onStart",
      `source=${source} seq=${this.seq} storageSeq=${local?.seq ?? "none"} remoteSeq=${remoteRead ? (remote?.seq ?? "none") : `skipped(${remoteSeq})`} ${fingerprint}`,
    );
  }

  /** the snapshot in this room's own Durable Object storage, if any */
  private async readLocalSnapshot(): Promise<RoomSnapshot | undefined> {
    const stored = await this.readMaybeGzipped(SNAPSHOT_KEY);
    return isRoomSnapshot(stored) ? stored : undefined;
  }

  /**
   * Read one storage key that may hold either a gzipped payload or, from an
   * older build, the plain structured-clone value. The value's own type is the
   * discriminator, so no format flag or second key is needed.
   */
  private async readMaybeGzipped(key: string): Promise<unknown> {
    const stored = await this.ctx.storage.get<unknown>(key);
    if (stored instanceof Uint8Array) return gunzipJson(stored);
    return stored;
  }

  private async readRemoteSnapshot(): Promise<RoomSnapshot | undefined> {
    if (!this.remoteStore) return undefined;
    return this.remoteStore.get(this.name);
  }

  onRequest(req: Request): Response | Promise<Response> {
    if (req.method === "GET") {
      // opt-in health snapshot: `?debug` reports how this room instance
      // hydrated and whether its writes are landing, without changing the
      // default response clients rely on.
      if (new URL(req.url).searchParams.has("debug")) {
        return this.debugResponse();
      }
      return Response.json(this.store.getState(), {
        headers: CORS_HEADERS,
      });
    }

    return new Response("Method not allowed", { status: 405 });
  }

  /**
   * Compare the in-memory state against both persistence targets so a single
   * request answers "did this room's persisted snapshot stop advancing?".
   *
   * Caveat: requesting this instantiates the room if it was evicted, so the
   * counters describe the instance you just woke, not the one that died. The
   * durable comparison below is what survives an eviction.
   */
  private async debugResponse(): Promise<Response> {
    const memoryState = this.store.getState();
    const memory = fingerprintParts(memoryState);
    const memoryFingerprint = formatFingerprint(memory);

    const [storage, remote, rawStored, alarm] = await Promise.all([
      this.describeSnapshot(() => this.readLocalSnapshot(), memoryFingerprint),
      this.describeSnapshot(() => this.readRemoteSnapshot(), memoryFingerprint),
      this.ctx.storage
        .get<unknown>(SNAPSHOT_KEY)
        .catch((): unknown => undefined),
      this.ctx.storage.getAlarm().catch((): null => null),
    ]);
    if (rawStored instanceof Uint8Array) {
      storage.compressed = true;
      storage.storedBytes = rawStored.byteLength;
    } else if (rawStored !== undefined) {
      storage.compressed = false;
    }

    const durabilityLag = this.seq - this.persistedSeq;

    const warnings: string[] = [];
    if (durabilityLag > 0) {
      warnings.push(
        `${durabilityLag} action(s) applied but not confirmed durable — a restart would lose them`,
      );
    }
    if (!this.remoteStore) {
      warnings.push(
        "no SNAPSHOTS R2 binding — room storage is the only durable copy",
      );
    }
    if (this.storageWrites.failed > 0) {
      warnings.push(
        `${this.storageWrites.failed} room storage write(s) failed (last: ${this.storageWrites.lastError})`,
      );
    }
    if (
      storage.storedBytes &&
      storage.storedBytes > STORAGE_VALUE_LIMIT * STORAGE_WARN_AT
    ) {
      warnings.push(
        `stored snapshot is ${storage.storedBytes} bytes, within ${Math.round((1 - STORAGE_WARN_AT) * 100)}% of the ${STORAGE_VALUE_LIMIT}-byte room storage limit`,
      );
    }
    if (this.remoteWrites.failed > 0) {
      warnings.push(
        `${this.remoteWrites.failed} remote snapshot write(s) failed (last: ${this.remoteWrites.lastError})`,
      );
    }
    if (this.hydration?.error) {
      warnings.push(`hydration errored: ${this.hydration.error}`);
    }

    return Response.json(
      {
        room: this.name,
        now: new Date().toISOString(),
        instance: {
          startedAt: new Date(this.instanceStartedAt).toISOString(),
          uptimeMs: Date.now() - this.instanceStartedAt,
        },
        seq: this.seq,
        persistedSeq: this.persistedSeq,
        durabilityLag,
        storedBytes: this.storedBytes,
        storageValueLimit: STORAGE_VALUE_LIMIT,
        connections: this.connectionCount(),
        rememberedActionIds: this.seenActionIds.size,
        memory: { ...memory, fingerprint: memoryFingerprint },
        storage,
        remote: { ...remote, target: this.remoteStore?.describe ?? null },
        hydration: this.hydration,
        writes: {
          storage: this.storageWrites,
          remote: {
            ...this.remoteWrites,
            enabled: !!this.remoteStore,
            pending: alarm !== null,
            scheduledFor: alarm === null ? null : new Date(alarm).toISOString(),
          },
        },
        lastAction: this.lastAction,
        lastError: this.lastError,
        healthy: warnings.length === 0,
        warnings,
      },
      { headers: CORS_HEADERS },
    );
  }

  /** read back what one target actually holds right now */
  private async describeSnapshot(
    read: () => Promise<RoomSnapshot | undefined>,
    memoryFingerprint: string,
  ): Promise<SnapshotInfo> {
    try {
      const snapshot = await read();
      if (!snapshot) return { present: false };
      const parts = fingerprintParts(snapshot.state);
      const fingerprint = formatFingerprint(parts);
      return {
        present: true,
        ...parts,
        fingerprint,
        seq: snapshot.seq,
        savedAt: snapshot.savedAt,
        matchesMemory: fingerprint === memoryFingerprint,
      };
    } catch (e) {
      return { present: false, error: describeError(e) };
    }
  }

  onConnect(conn: Connection, ctx: ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.name}
  url: ${new URL(ctx.request.url).pathname}`,
    );

    const servedState = this.store.getState();
    this.log(
      "onConnect",
      `conn=${conn.id} connections=${this.connectionCount()} serving roomstate seq=${this.seq} persistedSeq=${this.persistedSeq} ${stateFingerprint(servedState)}`,
    );

    // send the initial state to this client
    conn.send(JSON.stringify(this.roomstateMessage()));
  }

  async onMessage(sender: Connection, message: WSMessage) {
    // the protocol is JSON text frames only
    if (typeof message !== "string") return;
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    switch (parsed.type) {
      case "ping":
        // normally answered by the runtime's auto-response; this covers a
        // ping that isn't byte-identical to PING_FRAME
        sender.send(PONG_FRAME);
        return;
      case "catchup":
        this.handleCatchup(parsed, sender);
        return;
      case "action":
        await this.handleAction(parsed, sender, message);
        return;
    }
  }

  private async handleAction(
    parsed: ReduxAction,
    sender: Connection,
    rawMessage: string,
  ) {
    if (parsed.id && this.seenActionIds.has(parsed.id)) {
      // a re-send of an action already applied: confirm receipt again
      // (the original ack may have been lost) but don't apply it twice
      this.sendAck(sender, parsed.id);
      return;
    }

    // Apply the action *before* ordering or broadcasting it. The echo doubles
    // as the receipt confirmation, so anything broadcast is a promise that the
    // server applied it; ordering first would let an action that the reducer
    // refuses reach every peer (and, since step 2, enter the catch-up tail and
    // recentActionIds) while the server's own store never took it — leaving
    // the server silently behind every client until the next roomstate
    // reverted them all.
    try {
      this.store.dispatch(parsed.action);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error(
        `${LOG_PREFIX} room=${this.name} action:rejected type=${parsed.action?.type} id=${parsed.id ?? "none"} seq=${this.seq}`,
        e,
      );
      // seq is not consumed, the id is not remembered, nothing is broadcast:
      // the room is exactly as it was before this message arrived
      if (parsed.id) this.sendReject(sender, parsed.id, reason);
      return;
    }

    if (parsed.id) {
      // stamp the action with its canonical position and broadcast to
      // everyone *including* the sender: the echo doubles as the receipt
      // confirmation, and all replicas apply actions in seq order
      this.seq += 1;
      const stamped: StampedAction = {
        ...parsed,
        id: parsed.id,
        seq: this.seq,
      };
      const frame = JSON.stringify(stamped);
      this.rememberStampedAction(stamped, frame);
      this.broadcast(frame);
    } else {
      // legacy client that can't recognize its own echo: relay the
      // unstamped action to everyone else only. It has no ack channel, so a
      // rejection can only be silent for these.
      this.broadcast(rawMessage, [sender.id]);
    }

    const nextState = this.store.getState();
    const fingerprint = stateFingerprint(nextState);
    this.lastAction = {
      type: String(parsed.action?.type),
      seq: this.seq,
      at: new Date().toISOString(),
    };
    this.log(
      "handleAction",
      `type=${parsed.action?.type} id=${parsed.id ?? "none"} seq=${parsed.id ? this.seq : "n/a"} ${fingerprint}`,
    );

    this.persist(nextState, fingerprint);
  }

  /** the current state and sequencer position as one durable value */
  private buildSnapshot(state: AppState): RoomSnapshot {
    return {
      seq: this.seq,
      seenIds: Array.from(this.seenActionIds.keys()),
      state,
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Write the snapshot to both durable targets. Room storage takes it
   * immediately; the remote store coalesces, so a burst of actions costs one
   * signed round trip rather than one per action.
   */
  private persist(state: AppState, fingerprint: string) {
    this.localPending = { snapshot: this.buildSnapshot(state), fingerprint };
    void this.flushLocal();

    if (this.remoteStore) this.scheduleRemoteWrite();
  }

  /**
   * Drain the pending snapshot to room storage, gzipped, one write at a time.
   *
   * Two reasons this is a loop rather than a fire-and-forget put. Compressing
   * inserts an `await` before `storage.put`, so writes from separate actions
   * could otherwise reach storage out of order and leave an older snapshot as
   * the durable one. And a burst then costs one compression instead of one per
   * action, since the newest snapshot supersedes the rest.
   *
   * Only room storage is compressed — see `gzipJson`. The remote copy stays
   * plain JSON so it can be read with `curl` during an incident.
   */
  private async flushLocal() {
    if (this.localFlushing) return;
    this.localFlushing = true;
    try {
      while (this.localPending) {
        const { snapshot, fingerprint } = this.localPending;
        this.localPending = null;
        this.storageWrites.started += 1;
        try {
          const bytes = await gzipJson(snapshot);
          await this.ctx.storage.put(SNAPSHOT_KEY, bytes);
          this.storedBytes = bytes.byteLength;
          this.storageWrites.ok += 1;
          this.storageWrites.lastOkAt = new Date().toISOString();
          this.log(
            "storage.put:ok",
            `${fingerprint} seq=${snapshot.seq} gzip=${bytes.byteLength}B`,
          );
          this.notePersisted(snapshot.seq);
        } catch (e) {
          this.storageWrites.failed += 1;
          this.storageWrites.lastErrorAt = new Date().toISOString();
          this.storageWrites.lastError = describeError(e);
          this.recordError("storage.put", e);
          console.error(
            `${LOG_PREFIX} room=${this.name} storage.put:error ${fingerprint}`,
            e,
          );
        }
      }
    } finally {
      this.localFlushing = false;
    }
  }

  /**
   * Owe the remote store a write, carried by an alarm rather than a timer.
   * A pending timer would keep the room from hibernating and die with an
   * evicted instance; an alarm does neither, and wakes the room to run even
   * if every socket has gone away in the meantime.
   */
  private scheduleRemoteWrite(delayMs = REMOTE_WRITE_INTERVAL_MS) {
    if (this.remoteAlarmArmed) return;
    this.remoteAlarmArmed = true;
    this.ctx.storage.setAlarm(Date.now() + delayMs).catch((e: unknown) => {
      this.remoteAlarmArmed = false;
      this.recordError("setAlarm", e);
      console.error(`${LOG_PREFIX} room=${this.name} setAlarm:error`, e);
    });
  }

  async onAlarm() {
    // cleared first so an action landing mid-write arms the next alarm
    this.remoteAlarmArmed = false;
    await this.flushRemote();
  }

  /**
   * Write the current snapshot to the remote store. Builds it from the store
   * at write time rather than carrying one over from the action that armed
   * the alarm, so it is always the newest state, including after a wake that
   * rebuilt the store from room storage.
   */
  private async flushRemote() {
    if (!this.remoteStore) return;
    const snapshot = this.buildSnapshot(this.store.getState());
    this.remoteWrites.started += 1;
    try {
      await this.remoteStore.put(this.name, snapshot);
      this.remoteWrites.ok += 1;
      this.remoteWrites.lastOkAt = new Date().toISOString();
      this.log(
        "remote.put:ok",
        `seq=${snapshot.seq} ${stateFingerprint(snapshot.state)}`,
      );
      this.notePersisted(snapshot.seq);
      await this.ctx.storage.put(REMOTE_SEQ_KEY, snapshot.seq);
    } catch (e) {
      this.remoteWrites.failed += 1;
      this.remoteWrites.lastErrorAt = new Date().toISOString();
      this.remoteWrites.lastError = describeError(e);
      this.recordError("remote.put", e);
      console.error(
        `${LOG_PREFIX} room=${this.name} remote.put:error seq=${snapshot.seq}`,
        e,
      );
      this.scheduleRemoteWrite(REMOTE_RETRY_INTERVAL_MS);
    }
  }

  /**
   * A durable target confirmed everything up to `seq`. Advances the watermark
   * monotonically (targets settle out of order) and tells the room, throttled
   * so a busy event doesn't double its message volume.
   */
  private notePersisted(seq: number) {
    if (seq <= this.persistedSeq) return;
    this.persistedSeq = seq;

    const now = Date.now();
    const caughtUp = this.persistedSeq === this.seq;
    if (
      !caughtUp &&
      now - this.lastPersistedBroadcastAt < PERSISTED_BROADCAST_INTERVAL_MS
    ) {
      // still behind and we spoke recently; the next write will report again,
      // and clients evaluate the lag on their own timer regardless
      return;
    }
    this.lastPersistedBroadcastAt = now;
    this.broadcast(
      JSON.stringify(<Persisted>{
        type: "persisted",
        seq: this.persistedSeq,
        appliedSeq: this.seq,
      }),
    );
  }

  /**
   * Serve a client's catch-up request: replay the stamped actions after
   * `since`. If the gap reaches back further than our retained tail, fall
   * back to a full roomstate so the client resyncs wholesale.
   *
   * The tail lives in SQLite, not memory: with hibernation a client's socket
   * outlives the instance that served it, so the instance answering may have
   * just woken up.
   */
  private handleCatchup(req: CatchupRequest, sender: Connection) {
    if (req.since >= this.seq) {
      // client is already current (or ahead); nothing to replay
      this.log(
        "catchup",
        `conn=${sender.id} since=${req.since} result=current`,
      );
      sender.send(
        JSON.stringify(<CatchupResponse>{ type: "catchup", actions: [] }),
      );
      return;
    }
    const [{ earliest }] = this.ctx.storage.sql
      .exec<{ earliest: number | null }>(
        "SELECT MIN(seq) AS earliest FROM tail",
      )
      .toArray();
    if (earliest !== null && req.since >= earliest - 1) {
      const actions = this.ctx.storage.sql
        .exec<{
          action: string;
        }>("SELECT action FROM tail WHERE seq > ? ORDER BY seq", req.since)
        .toArray()
        .map((row) => JSON.parse(row.action) as StampedAction);
      this.log(
        "catchup",
        `conn=${sender.id} since=${req.since} result=replay actions=${actions.length} seq=${this.seq}`,
      );
      sender.send(
        JSON.stringify(<CatchupResponse>{ type: "catchup", actions }),
      );
    } else {
      // the gap predates our tail; only a fresh snapshot can repair the client
      this.log(
        "catchup",
        `conn=${sender.id} since=${req.since} result=full-roomstate earliest=${earliest} seq=${this.seq}`,
      );
      sender.send(JSON.stringify(this.roomstateMessage()));
    }
  }

  private roomstateMessage(): Roomstate {
    return {
      type: "roomstate",
      state: this.store.getState(),
      recentActionIds: Array.from(this.seenActionIds.keys()),
      seq: this.seq,
      persistedSeq: this.persistedSeq,
    };
  }

  onClose(conn: Connection) {
    // correlate socket cycles (flaky venue wifi) and hibernation wakes with
    // whichever snapshot was last served/persisted for this room.
    this.log(
      "onClose",
      `conn=${conn.id} connections=${this.connectionCount()} seq=${this.seq} persistedSeq=${this.persistedSeq} ${stateFingerprint(this.store.getState())}`,
    );
  }

  onError(conn: Connection, err: unknown) {
    console.error(
      `${LOG_PREFIX} room=${this.name} onError conn=${conn.id} seq=${this.seq}`,
      err,
    );
  }

  private sendAck(conn: Connection, id: string) {
    conn.send(JSON.stringify(<ActionAck>{ type: "ack", id }));
  }

  private sendReject(conn: Connection, id: string, reason: string) {
    conn.send(JSON.stringify(<ActionReject>{ type: "reject", id, reason }));
  }

  /** record a stamped action in the catch-up tail and the dedupe set */
  private rememberStampedAction(stamped: StampedAction, frame: string) {
    // REPLACE: a seq can be reissued after an eviction lost the snapshot
    // that covered it, and onStart already dropped the stale row
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO tail (seq, action) VALUES (?, ?)",
      stamped.seq,
      frame,
    );
    this.ctx.storage.sql.exec(
      "DELETE FROM tail WHERE seq <= ?",
      stamped.seq - MAX_TAIL,
    );
    this.seenActionIds.set(stamped.id, stamped.seq);
    if (this.seenActionIds.size > MAX_REMEMBERED_ACTIONS) {
      for (const oldest of this.seenActionIds.keys()) {
        this.seenActionIds.delete(oldest);
        break;
      }
    }
  }
}

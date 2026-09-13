import type * as Party from "partykit/server";
import type {
  ActionAck,
  ActionReject,
  CatchupRequest,
  CatchupResponse,
  ClientMessage,
  Persisted,
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
} from "./snapshot-store";
import { applyMigrations } from "../state/migrations";
import { gunzipJson, gzipJson } from "./compression";

const remoteStore = getR2SnapshotStore();

function isAppState(state: unknown): state is AppState {
  if (state && !Array.isArray(state) && typeof state === "object") {
    return "config" in state && "drawings" in state;
  }
  return false;
}

/** upper bound on remembered action ids used to dedupe client re-sends */
const MAX_REMEMBERED_ACTIONS = 1000;
/** how many recent stamped actions to retain for incremental catch-up */
const MAX_TAIL = 500;

/** storage key holding the room snapshot: state and sequencer metadata as one value */
const SNAPSHOT_KEY = "snapshot";
/** partykit room storage refuses any value larger than this */
const STORAGE_VALUE_LIMIT = 131072;
/** fraction of the limit a stored snapshot may reach before `?debug` complains */
const STORAGE_WARN_AT = 0.8;
/** pre-snapshot storage keys, read once so existing rooms carry forward */
const LEGACY_STATE_KEY = "currentState";
const LEGACY_META_KEY = "syncMeta";

/** shape of the pre-snapshot sequencer metadata */
interface LegacySyncMeta {
  seq: number;
  seenIds: string[];
}

/**
 * Minimum spacing between remote snapshot writes. Room storage is local and
 * cheap enough to write on every action; the remote store is a signed HTTPS
 * round trip, so writes coalesce and always carry the latest snapshot rather
 * than queueing one per action.
 */
const REMOTE_WRITE_INTERVAL_MS = 2000;

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
  /** bytes actually occupied — what the 131072 room storage limit measures */
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

export default class Server implements Party.Server {
  // @ts-expect-error I assign this for sure
  private store: typeof appReduxStore;

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

  /**
   * tail of recently stamped actions (ascending seq) used to answer catch-up
   * requests. In-memory only: a client only asks for catch-up after seeing a
   * gap on a *live* socket, which means this actor has been running the whole
   * time and the tail is intact. A restart/hibernation drops every socket, so
   * clients reconnect and take a fresh roomstate instead of catching up.
   */
  private tail: StampedAction[] = [];

  // ---- diagnostics, reported by `GET ...?debug`. In-memory only: they
  // describe the *current* room instance and reset when it is evicted.

  private instanceStartedAt = Date.now();

  /** how this instance's state was hydrated at startup */
  private hydration: {
    source: "storage" | "remote" | "legacy-storage" | "fresh";
    at: string;
    seq: number;
    fingerprint: string | null;
    /** what each candidate offered, so a wrong pick is visible after the fact */
    candidates: { storage: number | null; remote: number | null };
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

  /** latest snapshot awaiting a remote write, replaced rather than queued */
  private remotePending: RoomSnapshot | null = null;
  private remoteTimer: ReturnType<typeof setTimeout> | undefined;
  private remoteFlushing = false;

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

  constructor(readonly room: Party.Room) {
    console.log("constructor start");
  }

  /** emit a single greppable diagnostic line tagged with this room's id */
  private log(event: string, details = "") {
    console.log(
      `${LOG_PREFIX} room=${this.room.id} ${event}${details ? ` ${details}` : ""}`,
    );
  }

  /** current count of live connections, for correlating socket cycles */
  private connectionCount(): number {
    return [...this.room.getConnections()].length;
  }

  async onStart() {
    const hydrateErrors: string[] = [];

    // Read both durable copies and take whichever is further along, rather
    // than short-circuiting on the first one that answers. The old order was
    // `storage || remote`, so a stale-but-present local value pinned the room
    // to an old checkpoint and the remote copy was never even consulted —
    // precisely the case where the remote copy is the one still advancing,
    // because room storage rejects values over 128KiB and R2 does not.
    const [local, remote] = await Promise.all([
      this.readLocalSnapshot().catch((e: unknown) => {
        hydrateErrors.push(`storage: ${describeError(e)}`);
        this.recordError("onStart:storage", e);
        console.error(`${LOG_PREFIX} room=${this.room.id} onStart:storage`, e);
        return undefined;
      }),
      this.readRemoteSnapshot().catch((e: unknown) => {
        hydrateErrors.push(`remote: ${describeError(e)}`);
        this.recordError("onStart:remote", e);
        console.error(`${LOG_PREFIX} room=${this.room.id} onStart:remote`, e);
        return undefined;
      }),
    ]);

    let source: "storage" | "remote" | "legacy-storage" | "fresh" = "fresh";
    let chosen: RoomSnapshot | undefined;
    if (local && (!remote || local.snapshot.seq >= remote.seq)) {
      chosen = local.snapshot;
      source = local.legacy ? "legacy-storage" : "storage";
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

    const fingerprint = stateFingerprint(this.store.getState());
    this.hydration = {
      source,
      at: new Date().toISOString(),
      seq: this.seq,
      fingerprint,
      candidates: {
        storage: local?.snapshot.seq ?? null,
        remote: remote?.seq ?? null,
      },
      error: hydrateErrors.length ? hydrateErrors.join("; ") : null,
    };
    this.log(
      "onStart",
      `source=${source} seq=${this.seq} storageSeq=${local?.snapshot.seq ?? "none"} remoteSeq=${remote?.seq ?? "none"} ${fingerprint}`,
    );
  }

  /**
   * Room storage, preferring the single-value snapshot and falling back to the
   * pre-snapshot `currentState` + `syncMeta` pair so rooms written by an older
   * server keep their history across this upgrade. The legacy pair is only
   * ever read; the first write of this instance replaces it with a snapshot.
   */
  private async readLocalSnapshot(): Promise<
    { snapshot: RoomSnapshot; legacy: boolean } | undefined
  > {
    const stored = await this.readMaybeGzipped(SNAPSHOT_KEY);
    if (isRoomSnapshot(stored)) return { snapshot: stored, legacy: false };

    // The legacy pair may itself be gzipped: compressing `currentState` shipped
    // before this change, so a room upgrading straight from that build has a
    // Uint8Array under the old key. Reading it as a plain object would fail
    // `isAppState` and silently start the room fresh.
    const [state, meta] = await Promise.all([
      this.readMaybeGzipped(LEGACY_STATE_KEY),
      this.room.storage.get<LegacySyncMeta>(LEGACY_META_KEY),
    ]);
    if (!isAppState(state)) return undefined;
    // A legacy pair can be internally inconsistent — a meta that outran its
    // state is the bug the snapshot format exists to prevent — but there is no
    // way to detect that from the pair itself, and discarding the dedupe ids
    // to be safe would let a healthy room double-apply every re-send. Carry
    // both across as they were found; this path runs once per existing room,
    // and every write after it is atomic.
    return {
      snapshot: {
        seq: meta?.seq ?? 0,
        seenIds: meta?.seenIds ?? [],
        state,
        savedAt: new Date(0).toISOString(),
      },
      legacy: true,
    };
  }

  /**
   * Read one storage key that may hold either a gzipped payload or, from an
   * older build, the plain structured-clone value. The value's own type is the
   * discriminator, so no format flag or second key is needed.
   */
  private async readMaybeGzipped(key: string): Promise<unknown> {
    const stored = await this.room.storage.get<unknown>(key);
    if (stored instanceof Uint8Array) return gunzipJson(stored);
    return stored;
  }

  private async readRemoteSnapshot(): Promise<RoomSnapshot | undefined> {
    if (!remoteStore) return undefined;
    return remoteStore.get(this.room.id);
  }

  onRequest(req: Party.Request): Response | Promise<Response> {
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

    const [storage, remote, rawStored] = await Promise.all([
      this.describeSnapshot(
        () => this.readLocalSnapshot().then((r) => r?.snapshot),
        memoryFingerprint,
      ),
      this.describeSnapshot(() => this.readRemoteSnapshot(), memoryFingerprint),
      this.room.storage
        .get<unknown>(SNAPSHOT_KEY)
        .catch((): unknown => undefined),
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
    if (!remoteStore) {
      warnings.push(
        "no remote snapshot store configured — room storage is the only durable copy, and it rejects values over 131072 bytes",
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
        room: this.room.id,
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
        remote: { ...remote, target: remoteStore?.describe ?? null },
        hydration: this.hydration,
        writes: {
          storage: this.storageWrites,
          remote: {
            ...this.remoteWrites,
            enabled: !!remoteStore,
            pending: !!this.remotePending,
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

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
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

  async onMessage(message: string, sender: Party.Connection) {
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    switch (parsed.type) {
      case "ping":
        sender.send(JSON.stringify(<Pong>{ type: "pong" }));
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
    sender: Party.Connection,
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
        `${LOG_PREFIX} room=${this.room.id} action:rejected type=${parsed.action?.type} id=${parsed.id ?? "none"} seq=${this.seq}`,
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
      this.rememberStampedAction(stamped);
      this.room.broadcast(JSON.stringify(stamped));
    } else {
      // legacy client that can't recognize its own echo: relay the
      // unstamped action to everyone else only. It has no ack channel, so a
      // rejection can only be silent for these.
      this.room.broadcast(rawMessage, [sender.id]);
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
    const snapshot = this.buildSnapshot(state);

    this.localPending = { snapshot, fingerprint };
    void this.flushLocal();

    if (remoteStore) {
      this.remotePending = snapshot;
      this.scheduleRemoteWrite();
    }
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
          await this.room.storage.put(SNAPSHOT_KEY, bytes);
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
            `${LOG_PREFIX} room=${this.room.id} storage.put:error ${fingerprint}`,
            e,
          );
        }
      }
    } finally {
      this.localFlushing = false;
    }
  }

  private scheduleRemoteWrite() {
    if (this.remoteTimer) return;
    this.remoteTimer = setTimeout(() => {
      this.remoteTimer = undefined;
      void this.flushRemote();
    }, REMOTE_WRITE_INTERVAL_MS);
  }

  /**
   * Drain the pending snapshot to the remote store, one write at a time. Any
   * snapshot that arrives mid-flight replaces the pending one, so the loop
   * always writes the newest state rather than replaying a backlog.
   */
  private async flushRemote() {
    if (!remoteStore || this.remoteFlushing) return;
    this.remoteFlushing = true;
    try {
      while (this.remotePending) {
        const snapshot = this.remotePending;
        this.remotePending = null;
        this.remoteWrites.started += 1;
        try {
          await remoteStore.put(this.room.id, snapshot);
          this.remoteWrites.ok += 1;
          this.remoteWrites.lastOkAt = new Date().toISOString();
          this.log(
            "remote.put:ok",
            `seq=${snapshot.seq} ${stateFingerprint(snapshot.state)}`,
          );
          this.notePersisted(snapshot.seq);
        } catch (e) {
          this.remoteWrites.failed += 1;
          this.remoteWrites.lastErrorAt = new Date().toISOString();
          this.remoteWrites.lastError = describeError(e);
          this.recordError("remote.put", e);
          console.error(
            `${LOG_PREFIX} room=${this.room.id} remote.put:error seq=${snapshot.seq}`,
            e,
          );
        }
      }
    } finally {
      this.remoteFlushing = false;
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
    this.room.broadcast(
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
   */
  private handleCatchup(req: CatchupRequest, sender: Party.Connection) {
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
    const earliest = this.tail.length ? this.tail[0].seq : Infinity;
    if (req.since >= earliest - 1) {
      const actions = this.tail.filter((a) => a.seq > req.since);
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

  onClose(conn: Party.Connection) {
    // correlate socket cycles (flaky venue wifi) and potential hibernation with
    // whichever snapshot was last served/persisted for this room.
    this.log(
      "onClose",
      `conn=${conn.id} connections=${this.connectionCount()} seq=${this.seq} persistedSeq=${this.persistedSeq} ${stateFingerprint(this.store.getState())}`,
    );
  }

  onError(conn: Party.Connection, err: Error) {
    console.error(
      `${LOG_PREFIX} room=${this.room.id} onError conn=${conn.id} seq=${this.seq}`,
      err,
    );
  }

  private sendAck(conn: Party.Connection, id: string) {
    conn.send(JSON.stringify(<ActionAck>{ type: "ack", id }));
  }

  private sendReject(conn: Party.Connection, id: string, reason: string) {
    conn.send(JSON.stringify(<ActionReject>{ type: "reject", id, reason }));
  }

  private rememberStampedAction(stamped: StampedAction) {
    this.tail.push(stamped);
    if (this.tail.length > MAX_TAIL) {
      this.tail.shift();
    }
    this.seenActionIds.set(stamped.id, stamped.seq);
    if (this.seenActionIds.size > MAX_REMEMBERED_ACTIONS) {
      for (const oldest of this.seenActionIds.keys()) {
        this.seenActionIds.delete(oldest);
        break;
      }
    }
  }
}

Server satisfies Party.Worker;

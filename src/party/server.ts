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
 * Hibernation stays off (partyserver's default): the reducer store, sequencer
 * and catch-up tail live in memory, and coalesced remote writes run on timers.
 */
export class Main extends Server<Env> {
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
    source: "storage" | "remote" | "fresh";
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

    // Read both durable copies and take whichever is further along, rather
    // than short-circuiting on the first one that answers. The old order was
    // `storage || remote`, so a stale-but-present local value pinned the room
    // to an old checkpoint and the remote copy was never even consulted —
    // precisely the case where the remote copy is the one still advancing,
    // because room storage has a value size limit and R2 does not. It is also
    // how rooms saved by the partykit deploy come back: their Durable Object
    // storage starts empty here, and R2 still holds their snapshot.
    const [local, remote] = await Promise.all([
      this.readLocalSnapshot().catch((e: unknown) => {
        hydrateErrors.push(`storage: ${describeError(e)}`);
        this.recordError("onStart:storage", e);
        console.error(`${LOG_PREFIX} room=${this.name} onStart:storage`, e);
        return undefined;
      }),
      this.readRemoteSnapshot().catch((e: unknown) => {
        hydrateErrors.push(`remote: ${describeError(e)}`);
        this.recordError("onStart:remote", e);
        console.error(`${LOG_PREFIX} room=${this.name} onStart:remote`, e);
        return undefined;
      }),
    ]);

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
      error: hydrateErrors.length ? hydrateErrors.join("; ") : null,
    };
    this.log(
      "onStart",
      `source=${source} seq=${this.seq} storageSeq=${local?.seq ?? "none"} remoteSeq=${remote?.seq ?? "none"} ${fingerprint}`,
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

    const [storage, remote, rawStored] = await Promise.all([
      this.describeSnapshot(() => this.readLocalSnapshot(), memoryFingerprint),
      this.describeSnapshot(() => this.readRemoteSnapshot(), memoryFingerprint),
      this.ctx.storage
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
      this.rememberStampedAction(stamped);
      this.broadcast(JSON.stringify(stamped));
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
    const snapshot = this.buildSnapshot(state);

    this.localPending = { snapshot, fingerprint };
    void this.flushLocal();

    if (this.remoteStore) {
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
    if (!this.remoteStore || this.remoteFlushing) return;
    this.remoteFlushing = true;
    try {
      while (this.remotePending) {
        const snapshot = this.remotePending;
        this.remotePending = null;
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
        } catch (e) {
          this.remoteWrites.failed += 1;
          this.remoteWrites.lastErrorAt = new Date().toISOString();
          this.remoteWrites.lastError = describeError(e);
          this.recordError("remote.put", e);
          console.error(
            `${LOG_PREFIX} room=${this.name} remote.put:error seq=${snapshot.seq}`,
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

  onClose(conn: Connection) {
    // correlate socket cycles (flaky venue wifi) and potential hibernation with
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

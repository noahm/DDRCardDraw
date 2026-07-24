import type * as Party from "partykit/server";
import type { ActionAck, ReduxAction, Roomstate } from "./types";
import { configureStore } from "@reduxjs/toolkit";
import { reducer } from "../state/root-reducer";
import type { AppState } from "../state/store";

import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";
import { applyMigrations } from "../state/migrations";

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.log("Your env both SUPABASE_URL and SUPABASE_KEY available.");
    console.log("Disabling subpabase persistence.");
    return;
  }
  return createClient<Database>(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_KEY as string,
    { auth: { persistSession: false } },
  );
}

const supabase = getSupabase();

function isAppState(state: unknown): state is AppState {
  if (state && !Array.isArray(state) && typeof state === "object") {
    return "config" in state && "drawings" in state;
  }
  return false;
}

/** upper bound on remembered action ids used to dedupe client re-sends */
const MAX_REMEMBERED_ACTIONS = 1000;

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
  updatedAt?: string;
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

export default class Server implements Party.Server {
  // @ts-expect-error I assign this for sure
  private store: typeof appReduxStore;

  /** monotonic counter assigning the canonical order of applied actions */
  private seq = 0;

  /** recently applied action ids mapped to their seq, oldest first */
  private seenActionIds = new Map<string, number>();

  // ---- diagnostics, reported by `GET ...?debug`. In-memory only: they
  // describe the *current* room instance and reset when it is evicted.

  private instanceStartedAt = Date.now();

  /** how this instance's state was hydrated at startup */
  private hydration: {
    source: "storage" | "supabase" | "fresh";
    at: string;
    fingerprint: string | null;
    error: string | null;
  } | null = null;

  /** tallies for the fire-and-forget `currentState` writes */
  private storageWrites = {
    started: 0,
    ok: 0,
    failed: 0,
    lastOkAt: null as string | null,
    lastErrorAt: null as string | null,
  };

  private supabaseWrites = {
    ok: 0,
    failed: 0,
    lastOkAt: null as string | null,
    lastErrorAt: null as string | null,
  };

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
    let preloadedState: AppState | undefined;
    let source: "storage" | "supabase" | "fresh" = "fresh";
    let hydrateError: string | null = null;
    try {
      // preserve the original `storage || supabase` short-circuit: supabase is
      // only consulted when storage came back empty. Split apart only so the
      // hydration source can be logged.
      const fromStorage = await this.getFromStorage();
      const fromSupabase = fromStorage
        ? undefined
        : await this.getFromSupabase();
      preloadedState = fromStorage || fromSupabase;
      if (fromStorage) source = "storage";
      else if (fromSupabase) source = "supabase";
      if (preloadedState) applyMigrations(preloadedState);
    } catch (e) {
      // previously swallowed silently; surface it since a failed hydrate is a
      // prime suspect for reverting a room to a stale checkpoint.
      hydrateError = describeError(e);
      this.recordError("onStart", e);
      console.error(
        `${LOG_PREFIX} room=${this.room.id} onStart:hydrate-error`,
        e,
      );
    }
    if (preloadedState) {
      this.store = configureStore({ reducer, preloadedState });
    } else {
      this.store = configureStore({ reducer });
    }
    const fingerprint = stateFingerprint(this.store.getState());
    this.hydration = {
      source,
      at: new Date().toISOString(),
      fingerprint,
      error: hydrateError,
    };
    this.log("onStart", `source=${source} seq=${this.seq} ${fingerprint}`);
  }

  private async getFromSupabase() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("event_state")
      .select("state")
      .eq("id", this.room.id)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (data && isAppState(data.state)) return data.state;
  }

  private getFromStorage() {
    return this.room.storage.get<AppState>("currentState");
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

    const [storage, supabaseSnapshot] = await Promise.all([
      this.describeStorage(memoryFingerprint),
      this.describeSupabase(memoryFingerprint),
    ]);

    const unsettled =
      this.storageWrites.started -
      this.storageWrites.ok -
      this.storageWrites.failed;

    const warnings: string[] = [];
    if (unsettled > 0) {
      warnings.push(
        `${unsettled} storage write(s) started but never settled — they may not flush before eviction`,
      );
    }
    if (storage.present && storage.matchesMemory === false) {
      warnings.push(
        "persisted storage snapshot differs from in-memory state — the durable write is not keeping up",
      );
    }
    if (!storage.present && this.lastAction) {
      warnings.push(
        "no currentState in storage despite actions having been applied",
      );
    }
    if (
      storage.present &&
      supabaseSnapshot.present &&
      storage.fingerprint !== supabaseSnapshot.fingerprint
    ) {
      warnings.push(
        "storage and supabase disagree — onStart prefers storage, so a stale storage value pins this room to an old checkpoint",
      );
    }
    if (this.storageWrites.failed > 0) {
      warnings.push(`${this.storageWrites.failed} storage write(s) failed`);
    }
    if (this.supabaseWrites.failed > 0) {
      warnings.push(`${this.supabaseWrites.failed} supabase upsert(s) failed`);
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
        connections: this.connectionCount(),
        rememberedActionIds: this.seenActionIds.size,
        memory: { ...memory, fingerprint: memoryFingerprint },
        storage,
        supabase: supabaseSnapshot,
        hydration: this.hydration,
        writes: {
          storage: { ...this.storageWrites, unsettled },
          supabase: { ...this.supabaseWrites, enabled: !!supabase },
        },
        lastAction: this.lastAction,
        lastError: this.lastError,
        healthy: warnings.length === 0,
        warnings,
      },
      { headers: CORS_HEADERS },
    );
  }

  /** read back what is actually durable in room storage right now */
  private async describeStorage(
    memoryFingerprint: string,
  ): Promise<SnapshotInfo> {
    try {
      const stored = await this.getFromStorage();
      if (!stored) return { present: false };
      const parts = fingerprintParts(stored);
      const fingerprint = formatFingerprint(parts);
      return {
        present: true,
        ...parts,
        fingerprint,
        matchesMemory: fingerprint === memoryFingerprint,
      };
    } catch (e) {
      return { present: false, error: describeError(e) };
    }
  }

  private async describeSupabase(
    memoryFingerprint: string,
  ): Promise<SnapshotInfo> {
    if (!supabase) return { present: false, error: "supabase not configured" };
    try {
      const { data, error } = await supabase
        .from("event_state")
        .select("state, updated_at")
        .eq("id", this.room.id)
        .maybeSingle();
      if (error) return { present: false, error: error.message };
      if (!data) return { present: false };
      if (!isAppState(data.state)) {
        return {
          present: true,
          updatedAt: data.updated_at,
          error: "stored row is not a recognizable AppState",
        };
      }
      const parts = fingerprintParts(data.state);
      const fingerprint = formatFingerprint(parts);
      return {
        present: true,
        ...parts,
        fingerprint,
        updatedAt: data.updated_at,
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
      `conn=${conn.id} connections=${this.connectionCount()} serving roomstate seq=${this.seq} ${stateFingerprint(servedState)}`,
    );

    // send the initial state to this client
    conn.send(
      JSON.stringify(<Roomstate>{
        type: "roomstate",
        state: servedState,
        recentActionIds: Array.from(this.seenActionIds.keys()),
        seq: this.seq,
      }),
    );
  }

  async onMessage(message: string, sender: Party.Connection) {
    const parsed = JSON.parse(message) as ReduxAction;

    if (parsed.id && this.seenActionIds.has(parsed.id)) {
      // a re-send of an action already applied: confirm receipt again
      // (the original ack may have been lost) but don't apply it twice
      this.sendAck(sender, parsed.id);
      return;
    }

    if (parsed.id) {
      // stamp the action with its canonical position and broadcast to
      // everyone *including* the sender: the echo doubles as the receipt
      // confirmation, and all replicas apply actions in seq order
      this.seq += 1;
      const stamped: ReduxAction = { ...parsed, seq: this.seq };
      this.room.broadcast(JSON.stringify(stamped));
    } else {
      // legacy client that can't recognize its own echo: relay the
      // unstamped action to everyone else only
      this.room.broadcast(message, [sender.id]);
    }

    // resolve the new state
    this.store.dispatch(parsed.action);
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

    // persist to partykit storage. Still fire-and-forget (unchanged behavior);
    // wrapped only so we can observe whether the write actually resolves before
    // the room is evicted/hibernated, or rejects.
    this.storageWrites.started += 1;
    this.log("storage.put:start", fingerprint);
    void this.room.storage
      .put("currentState", nextState)
      .then(() => {
        this.storageWrites.ok += 1;
        this.storageWrites.lastOkAt = new Date().toISOString();
        this.log("storage.put:ok", fingerprint);
      })
      .catch((e: unknown) => {
        this.storageWrites.failed += 1;
        this.storageWrites.lastErrorAt = new Date().toISOString();
        this.recordError("storage.put", e);
        console.error(
          `${LOG_PREFIX} room=${this.room.id} storage.put:error ${fingerprint}`,
          e,
        );
      });

    if (parsed.id) {
      this.rememberActionId(parsed.id);
    }
    // persist the state to supabase
    try {
      if (supabase) {
        // supabase returns errors in the result rather than throwing, so the
        // existing catch never saw them: capture and log the returned error
        // loudly, since a swallowed upsert failure would leave the served
        // snapshot stale on the next reconnect.
        const { error } = await supabase.from("event_state").upsert({
          id: this.room.id,
          state: nextState as unknown as Json,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          this.supabaseWrites.failed += 1;
          this.supabaseWrites.lastErrorAt = new Date().toISOString();
          this.recordError("supabase.upsert", error);
          console.error(
            `${LOG_PREFIX} room=${this.room.id} supabase.upsert:error ${fingerprint}`,
            error,
          );
        } else {
          this.supabaseWrites.ok += 1;
          this.supabaseWrites.lastOkAt = new Date().toISOString();
          this.log("supabase.upsert:ok", fingerprint);
        }
      }
    } catch (e) {
      this.supabaseWrites.failed += 1;
      this.supabaseWrites.lastErrorAt = new Date().toISOString();
      this.recordError("supabase.upsert", e);
      console.error(
        `${LOG_PREFIX} room=${this.room.id} supabase.upsert:throw ${fingerprint}`,
        e,
      );
    }
  }

  onClose(conn: Party.Connection) {
    // correlate socket cycles (flaky venue wifi) and potential hibernation with
    // whichever snapshot was last served/persisted for this room.
    this.log(
      "onClose",
      `conn=${conn.id} connections=${this.connectionCount()} seq=${this.seq} ${stateFingerprint(this.store.getState())}`,
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

  private rememberActionId(id: string) {
    this.seenActionIds.set(id, this.seq);
    if (this.seenActionIds.size > MAX_REMEMBERED_ACTIONS) {
      for (const oldest of this.seenActionIds.keys()) {
        this.seenActionIds.delete(oldest);
        break;
      }
    }
  }
}

Server satisfies Party.Worker;

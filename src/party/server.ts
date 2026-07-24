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
 * Cheap, side-effect-free fingerprint of the shared state so log lines can be
 * compared across events to see whether the persisted snapshot advanced. Uses
 * the drawings entity count plus the serialized length as a poor-man's hash;
 * this is for observability only and never feeds back into state.
 */
function stateFingerprint(state: AppState): string {
  const drawings = state.drawings?.ids?.length ?? 0;
  let stateLen = -1;
  try {
    stateLen = JSON.stringify(state).length;
  } catch {
    stateLen = -1;
  }
  return `drawings=${drawings} stateLen=${stateLen}`;
}

export default class Server implements Party.Server {
  // @ts-expect-error I assign this for sure
  private store: typeof appReduxStore;

  /** monotonic counter assigning the canonical order of applied actions */
  private seq = 0;

  /** recently applied action ids mapped to their seq, oldest first */
  private seenActionIds = new Map<string, number>();

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
    let source = "fresh";
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
    this.log(
      "onStart",
      `source=${source} seq=${this.seq} ${stateFingerprint(this.store.getState())}`,
    );
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
      return Response.json(this.store.getState(), {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response("Method not allowed", { status: 405 });
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
    this.log(
      "handleAction",
      `type=${parsed.action?.type} id=${parsed.id ?? "none"} seq=${parsed.id ? this.seq : "n/a"} ${fingerprint}`,
    );

    // persist to partykit storage. Still fire-and-forget (unchanged behavior);
    // wrapped only so we can observe whether the write actually resolves before
    // the room is evicted/hibernated, or rejects.
    this.log("storage.put:start", fingerprint);
    void this.room.storage
      .put("currentState", nextState)
      .then(() => this.log("storage.put:ok", fingerprint))
      .catch((e: unknown) =>
        console.error(
          `${LOG_PREFIX} room=${this.room.id} storage.put:error ${fingerprint}`,
          e,
        ),
      );

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
          console.error(
            `${LOG_PREFIX} room=${this.room.id} supabase.upsert:error ${fingerprint}`,
            error,
          );
        } else {
          this.log("supabase.upsert:ok", fingerprint);
        }
      }
    } catch (e) {
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

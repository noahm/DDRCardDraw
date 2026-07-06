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

  async onStart() {
    let preloadedState: AppState | undefined;
    try {
      preloadedState =
        (await this.getFromStorage()) || (await this.getFromSupabase());
      if (preloadedState) applyMigrations(preloadedState);
    } catch {}
    if (preloadedState) {
      this.store = configureStore({ reducer, preloadedState });
    } else {
      this.store = configureStore({ reducer });
    }
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
      return new Response(JSON.stringify(this.store.getState()), {
        headers: { "Content-Type": "application/json" },
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

    // send the initial state to this client
    conn.send(
      JSON.stringify(<Roomstate>{
        type: "roomstate",
        state: this.store.getState(),
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
    // persist to partykit storage
    void this.room.storage.put("currentState", nextState);

    if (parsed.id) {
      this.rememberActionId(parsed.id);
    }
    // persist the state to supabase
    try {
      if (supabase) {
        await supabase.from("event_state").upsert({
          id: this.room.id,
          state: nextState as unknown as Json,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn("error with upsert", e);
    }
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

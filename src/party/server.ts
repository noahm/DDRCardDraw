import type * as Party from "partykit/server";
import type {
  ActionAck,
  CatchupRequest,
  CatchupResponse,
  ClientMessage,
  Pong,
  ReduxAction,
  Roomstate,
  StampedAction,
} from "./types";
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
/** how many recent stamped actions to retain for incremental catch-up */
const MAX_TAIL = 500;
/** storage key holding the sequencer counter + dedupe set (survives hibernation) */
const SYNC_META_KEY = "syncMeta";

/** shape of the persisted sequencer metadata */
interface SyncMeta {
  seq: number;
  seenIds: string[];
}

export default class Server implements Party.Server {
  // @ts-expect-error I assign this for sure
  private store: typeof appReduxStore;

  /** monotonic counter assigning the canonical order of applied actions */
  private seq = 0;

  /** recently applied action ids mapped to their seq, oldest first */
  private seenActionIds = new Map<string, number>();

  /**
   * tail of recently stamped actions (ascending seq) used to answer catch-up
   * requests. In-memory only: a client only asks for catch-up after seeing a
   * gap on a *live* socket, which means this actor has been running the whole
   * time and the tail is intact. A restart/hibernation drops every socket, so
   * clients reconnect and take a fresh roomstate instead of catching up.
   */
  private tail: StampedAction[] = [];

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
    // restore the sequencer counter + dedupe set so a hibernated/restarted
    // room doesn't reset seq to 0 or forget which ids it already applied
    // (which would let a client's re-send be applied a second time)
    try {
      const meta = await this.room.storage.get<SyncMeta>(SYNC_META_KEY);
      if (meta) {
        this.seq = meta.seq;
        this.seenActionIds = new Map(meta.seenIds.map((id) => [id, meta.seq]));
      }
    } catch {}
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
      // unstamped action to everyone else only
      this.room.broadcast(rawMessage, [sender.id]);
    }

    // resolve the new state
    this.store.dispatch(parsed.action);
    const nextState = this.store.getState();
    // persist to partykit storage: the state itself, plus the sequencer
    // metadata so dedupe/ordering survive a hibernation or restart
    void this.room.storage.put("currentState", nextState);
    if (parsed.id) {
      void this.room.storage.put<SyncMeta>(SYNC_META_KEY, {
        seq: this.seq,
        seenIds: Array.from(this.seenActionIds.keys()),
      });
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

  /**
   * Serve a client's catch-up request: replay the stamped actions after
   * `since`. If the gap reaches back further than our retained tail, fall
   * back to a full roomstate so the client resyncs wholesale.
   */
  private handleCatchup(req: CatchupRequest, sender: Party.Connection) {
    if (req.since >= this.seq) {
      // client is already current (or ahead); nothing to replay
      sender.send(
        JSON.stringify(<CatchupResponse>{ type: "catchup", actions: [] }),
      );
      return;
    }
    const earliest = this.tail.length ? this.tail[0].seq : Infinity;
    if (req.since >= earliest - 1) {
      const actions = this.tail.filter((a) => a.seq > req.since);
      sender.send(
        JSON.stringify(<CatchupResponse>{ type: "catchup", actions }),
      );
    } else {
      // the gap predates our tail; only a fresh snapshot can repair the client
      sender.send(JSON.stringify(this.roomstateMessage()));
    }
  }

  private roomstateMessage(): Roomstate {
    return {
      type: "roomstate",
      state: this.store.getState(),
      recentActionIds: Array.from(this.seenActionIds.keys()),
      seq: this.seq,
    };
  }

  private sendAck(conn: Party.Connection, id: string) {
    conn.send(JSON.stringify(<ActionAck>{ type: "ack", id }));
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

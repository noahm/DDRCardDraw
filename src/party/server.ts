import type * as Party from "partykit/server";
import type { ReduxAction, Roomstate } from "./types";
import { configureStore } from "@reduxjs/toolkit";
import { reducer } from "../state/root-reducer";
import { AppState, type store as appReduxStore } from "../state/store";

import { createClient } from "@supabase/supabase-js";
import { Database, Json } from "./database.types";

const supabase = createClient<Database>(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_KEY as string,
  { auth: { persistSession: false } },
);

function isAppState(state: unknown): state is AppState {
  if (state && !Array.isArray(state) && typeof state === "object") {
    return "config" in state && "drawings" in state;
  }
  return false;
}

export default class Server implements Party.Server {
  // @ts-expect-error I assign this for sure
  private store: typeof appReduxStore;

  constructor(readonly room: Party.Room) {
    console.log("constructor start");
  }

  async onStart() {
    let preloadedState: AppState | undefined;
    try {
      preloadedState =
        (await this.getFromStorage()) || (await this.getFromSupabase());
    } catch {}
    if (preloadedState) {
      this.store = configureStore({ reducer, preloadedState });
    } else {
      this.store = configureStore({ reducer });
    }
  }

  private async getFromSupabase() {
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

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`,
    );

    // send the initial state to this client
    conn.send(this.getRoomState());
  }

  onMessage(message: string, sender: Party.Connection) {
    // broadcast it to all the other connections in the room...
    this.room.broadcast(
      message,
      // ...except for the connection it came from
      [sender.id],
    );

    const parsed = JSON.parse(message) as ReduxAction;
    // resolve the new state
    this.store.dispatch(parsed.action);
    const nextState = this.store.getState();
    // persist to partykit storage
    this.room.storage.put("currentState", nextState);
    // persist the state to supabase
    supabase.from("event_state").upsert({
      id: this.room.id,
      state: nextState as unknown as Json,
      updated_at: new Date().toISOString(),
    });
  }

  private getRoomState() {
    return JSON.stringify(<Roomstate>{
      type: "roomstate",
      state: this.store.getState(),
    });
  }
}

Server satisfies Party.Worker;

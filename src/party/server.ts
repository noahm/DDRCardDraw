import type * as Party from "partykit/server";
import type { ReduxAction, Roomstate } from "./types";
import { configureStore } from "@reduxjs/toolkit";
import { reducer } from "../state/root-reducer";
import { AppState } from "../state/store";

export default class Server implements Party.Server {
  // @ts-expect-error I assign this for sure
  private store: ReturnType<typeof configureStore>;

  constructor(readonly room: Party.Room) {
    console.log("constructor start");
  }

  async onStart() {
    const preloadedState =
      await this.room.storage.get<AppState>("currentState");
    this.store = configureStore({ reducer, preloadedState });
    this.store.subscribe(() => {
      this.room.storage.put("currentState", this.store.getState());
    });
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
    // let's log the message
    console.log(`connection ${sender.id} sent message: ${message}`);
    // as well as broadcast it to all the other connections in the room...
    this.room.broadcast(
      message,
      // ...except for the connection it came from
      [sender.id],
    );

    const parsed = JSON.parse(message) as ReduxAction;
    this.store.dispatch(parsed.action);
  }

  private getRoomState() {
    return JSON.stringify(<Roomstate>{
      type: "roomstate",
      state: this.store.getState(),
    });
  }
}

Server satisfies Party.Worker;

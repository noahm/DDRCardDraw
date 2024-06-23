import type * as Party from "partykit/server";
import type { Drawing } from "../models/Drawing";
import type { ConfigState } from "../config-state";
import type { Serialized } from "../config-persistence";
import type { ClientMsg, Roomstate } from "./types";

export default class Server implements Party.Server {
  private dataSetName?: string;
  private drawings: Drawing[] = [];
  private config?: Serialized<ConfigState>;

  constructor(readonly room: Party.Room) {}

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

    const parsed = JSON.parse(message) as ClientMsg;
    switch (parsed.type) {
      case "config":
        this.config = parsed.config;
        this.persistConfig();
        break;
      case "drawings":
        this.drawings = parsed.drawings;
        this.room.storage.put("allDrawings", this.drawings);
        break;
      case "dataSet":
        if (typeof parsed.data === "string") {
          this.dataSetName = parsed.data;
        } else {
          console.error(`party server does not yet support custom data`);
        }
        break;
    }
  }

  private getRoomState() {
    return JSON.stringify({
      type: "roomstate",
      drawings: this.drawings,
      config: this.config,
      dataSetName: this.dataSetName,
    } satisfies Roomstate);
  }

  private persistConfig() {
    this.room.storage.put("config", this.config);
  }

  private async restoreFromStorage() {
    this.config = await this.room.storage.get("config");
    this.drawings =
      (await this.room.storage.get<Drawing[]>(`allDrawings`)) || [];
  }
}

Server satisfies Party.Worker;

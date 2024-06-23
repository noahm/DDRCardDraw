import PartySocket from "partysocket";
import type { Broadcast, ClientMsg } from "./types";
import {
  applySerializedConfig,
  loadFromRoomstate,
} from "../config-persistence";
import { useDrawState } from "../draw-state";

const socket = new PartySocket({
  room: "default", // TODO picked off the path?
  host: "localhost:43735", // TODO determine this after deploy, or local?
});

socket.addEventListener("message", (evt) => {
  try {
    const data: Broadcast = JSON.parse(evt.data);
    switch (data.type) {
      case "roomstate":
        loadFromRoomstate(data);
        break;
      case "config":
        applySerializedConfig(data.config);
        break;
      case "dataSet":
        if (typeof data.data === "string") {
          useDrawState.getState().loadGameData(data.data);
        }
        break;
      case "drawings":
        useDrawState.setState({ drawings: data.drawings });
        break;
    }
  } catch (e) {
    console.warn("failed to handle party socket message", e);
  }
});

export function sendToParty(message: ClientMsg) {
  socket.send(JSON.stringify(message));
}

import usePartySocket from "partysocket/react";
import type { Broadcast, ReduxAction } from "./types";
import { useAppDispatch } from "../state/store";
import { receivePartyState } from "../state/central";
import { startAppListening } from "../state/listener-middleware";
import { useEffect } from "react";
import { loadGameDataByName } from "../state/thunks";

export function PartySocketManager(props: { roomName?: string }) {
  const dispatch = useAppDispatch();
  const socket = usePartySocket({
    room: props.roomName,
    host: "localhost:1999", // TODO determine this based on build type, other stuff
    onMessage(evt) {
      try {
        const data: Broadcast = JSON.parse(evt.data);
        switch (data.type) {
          case "roomstate":
            dispatch(receivePartyState(data.state));
            break;
          case "action":
            const foreignAction = {
              ...data.action,
              meta: { source: "partykit" },
            };
            dispatch(foreignAction);
            break;
        }
      } catch (e) {
        console.warn("failed to handle party socket message", e);
      }
    },
  });

  useEffect(() => {
    return startAppListening({
      predicate(action) {
        // @ts-expect-error i don't know how to type action meta properties yet
        if (action.meta?.source === "partykit") {
          return false;
        }

        if (receivePartyState.match(action)) {
          return false;
        }

        // don't try sending the loaded game data through
        if (action.type.startsWith(loadGameDataByName.typePrefix)) {
          return false;
        }
        return true;
      },
      effect(action) {
        const message: ReduxAction = {
          type: "action",
          action,
        };
        socket.send(JSON.stringify(message));
      },
    });
  }, [socket]);

  return null;
}

import usePartySocket from "partysocket/react";
import type { Broadcast, ReduxAction } from "./types";
import { useAppDispatch } from "../state/store";
import { receiveRoomState } from "../state/central";
import { startAppListening } from "../state/listener-middleware";
import React, { useEffect, useState } from "react";
import { Card, NonIdealState, Spinner } from "@blueprintjs/core";
import { DelayRender } from "../utils/delay-render";
import { applyMigrations } from "../state/migrations";
import { REALTIME_HOST } from "./host";

export function RoomSocketManager(props: {
  roomName?: string;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  // TODO move this state to redux???
  const [ready, setReady] = useState(false);
  const socket = usePartySocket({
    room: props.roomName,
    host: REALTIME_HOST,
    onMessage(evt) {
      try {
        const data: Broadcast = JSON.parse(evt.data);
        switch (data.type) {
          case "roomstate":
            applyMigrations(data.state);
            dispatch(receiveRoomState(data.state));
            setReady(true);
            break;
          case "action":
            const foreignAction = {
              ...data.action,
              meta: { source: "realtime" },
            };
            dispatch(foreignAction);
            break;
        }
      } catch (e) {
        console.warn("failed to handle realtime socket message", e);
      }
    },
  });

  useEffect(() => {
    return startAppListening({
      predicate(action) {
        // @ts-expect-error i don't know how to type action meta properties yet
        if (action.meta?.source === "realtime") {
          return false;
        }

        if (receiveRoomState.match(action)) {
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

  if (!ready) {
    return (
      <section
        style={{ display: "flex", justifyContent: "center", marginTop: "15vh" }}
      >
        <DelayRender>
          <Card elevation={2} style={{ maxWidth: "30rem" }}>
            <NonIdealState icon={<Spinner />} title="Connecting..." />
          </Card>
        </DelayRender>
      </section>
    );
  }
  return props.children;
}

import usePartySocket from "partysocket/react";
import type { Broadcast, ReduxAction } from "./types";
import { useAppDispatch } from "../state/store";
import { receivePartyState } from "../state/central";
import { startAppListening } from "../state/listener-middleware";
import React, { useEffect, useState } from "react";
import { Card, Loader } from "@mantine/core";
import { EmptyState } from "../common-components/empty-state";
import { DelayRender } from "../utils/delay-render";
import { applyMigrations } from "../state/migrations";
import { PARTYKIT_HOST } from "./host";

export function PartySocketManager(props: {
  roomName?: string;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  // TODO move this state to redux???
  const [ready, setReady] = useState(false);
  const socket = usePartySocket({
    room: props.roomName,
    host: PARTYKIT_HOST,
    onMessage(evt) {
      try {
        const data: Broadcast = JSON.parse(evt.data);
        switch (data.type) {
          case "roomstate":
            applyMigrations(data.state);
            dispatch(receivePartyState(data.state));
            setReady(true);
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
          <Card withBorder shadow="md" style={{ maxWidth: "30rem" }}>
            <EmptyState icon={<Loader />} title="Connecting..." />
          </Card>
        </DelayRender>
      </section>
    );
  }
  return props.children;
}

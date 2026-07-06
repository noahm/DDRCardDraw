import usePartySocket from "partysocket/react";
import type { Broadcast, ReduxAction } from "./types";
import { useAppDispatch } from "../state/store";
import { receivePartyState } from "../state/central";
import { startAppListening } from "../state/listener-middleware";
import React, { useEffect, useRef, useState } from "react";
import { Card, Intent, NonIdealState, Spinner } from "@blueprintjs/core";
import { Offline } from "@blueprintjs/icons";
import { DelayRender } from "../utils/delay-render";
import { applyMigrations } from "../state/migrations";
import { PARTYKIT_HOST } from "./host";
import { toaster } from "../toaster";
import { useIntl } from "../hooks/useIntl";
import { useInObs } from "../theme-toggle";
import {
  setBlockedActionHandler,
  setPartyConnectionHealthy,
} from "./connection-status";

const HEALTH_TOAST_KEY = "party-connection-health";
const BLOCKED_TOAST_KEY = "party-action-blocked";

export function PartySocketManager(props: {
  roomName?: string;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const { t } = useIntl();
  const inObs = useInObs();
  // TODO move this state to redux???
  const [ready, setReady] = useState(false);
  // tracks if the user has been notified of a dead connection,
  // so we only announce a reconnect after announcing a disconnect
  const disconnectedRef = useRef(false);
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
    onClose() {
      setPartyConnectionHealthy(false);
      // before first sync the full-page "Connecting..." state covers this
      if (!ready || disconnectedRef.current) {
        return;
      }
      disconnectedRef.current = true;
      if (inObs) return;
      toaster.show(
        {
          message: t("party.disconnected"),
          icon: <Offline />,
          intent: Intent.DANGER,
          timeout: 0,
        },
        HEALTH_TOAST_KEY,
      );
    },
    onOpen() {
      setPartyConnectionHealthy(true);
      if (!disconnectedRef.current) {
        return;
      }
      disconnectedRef.current = false;
      if (inObs) return;
      toaster.dismiss(BLOCKED_TOAST_KEY);
      toaster.show(
        {
          message: t("party.reconnected"),
          intent: Intent.SUCCESS,
        },
        HEALTH_TOAST_KEY,
      );
    },
  });

  useEffect(() => {
    setBlockedActionHandler(() => {
      if (inObs) return;
      toaster.show(
        {
          message: t("party.actionBlocked"),
          intent: Intent.WARNING,
        },
        BLOCKED_TOAST_KEY,
      );
    });
    return () => {
      setBlockedActionHandler(undefined);
    };
  }, [t, inObs]);

  useEffect(() => {
    // when leaving a party session, unblock dispatch for other app modes
    return () => {
      setPartyConnectionHealthy(true);
      toaster.dismiss(HEALTH_TOAST_KEY);
      toaster.dismiss(BLOCKED_TOAST_KEY);
    };
  }, []);

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
          <Card elevation={2} style={{ maxWidth: "30rem" }}>
            <NonIdealState icon={<Spinner />} title="Connecting..." />
          </Card>
        </DelayRender>
      </section>
    );
  }
  return props.children;
}

import usePartySocket from "partysocket/react";
import type { Broadcast } from "./types";
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
import { SyncManager } from "./sync-manager";
import { logDiagnostic, setPendingActionsProvider } from "./diagnostics";

const HEALTH_TOAST_KEY = "party-connection-health";
const BLOCKED_TOAST_KEY = "party-action-blocked";
const SEND_FAILED_TOAST_KEY = "party-action-send-failed";
const REJECTED_TOAST_KEY = "party-action-rejected";

/** how often to ping the server to prove the socket is really alive */
const HEARTBEAT_INTERVAL_MS = 10000;
/** consecutive unanswered pings that mean a stalled (half-open) connection */
const MAX_MISSED_PONGS = 2;

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
  const syncRef = useRef<SyncManager | null>(null);
  // consecutive heartbeats sent without a pong back; a stalled-but-open
  // socket (server frozen, half-open TCP) is otherwise invisible
  const missedPongsRef = useRef(0);
  // keeps the sync manager's give-up toast bound to the current locale
  // without recreating it (which would drop pending actions)
  const sendFailedToast = useRef(() => {});
  // same, for an action the server refused outright
  const rejectedToast = useRef((_reason: string) => {});

  const socket = usePartySocket({
    room: props.roomName,
    host: PARTYKIT_HOST,
    onMessage(evt) {
      try {
        const data: Broadcast = JSON.parse(evt.data);
        switch (data.type) {
          case "roomstate":
            applyMigrations(data.state);
            logDiagnostic(
              disconnectedRef.current ? "reconnected" : "connected",
              `received room state (seq ${data.seq ?? "n/a"})`,
            );
            // adopt the server state as confirmed, rebasing anything that
            // went unconfirmed before this (re)connect on top of it
            dispatch(
              receivePartyState(
                syncRef.current?.handleRoomstate(data) ?? data.state,
              ),
            );
            // dispatch stays blocked until the resync above is complete
            missedPongsRef.current = 0;
            setPartyConnectionHealthy(true);
            if (disconnectedRef.current) {
              disconnectedRef.current = false;
              if (!inObs) {
                toaster.dismiss(BLOCKED_TOAST_KEY);
                toaster.show(
                  {
                    message: t("party.reconnected"),
                    intent: Intent.SUCCESS,
                  },
                  HEALTH_TOAST_KEY,
                );
              }
            }
            setReady(true);
            break;
          case "action":
            syncRef.current?.handleRemoteAction(data);
            break;
          case "catchup":
            logDiagnostic(
              "catch-up",
              `server replayed ${data.actions.length} missed change(s)`,
            );
            syncRef.current?.handleCatchup(data.actions);
            break;
          case "ack":
            syncRef.current?.handleAck(data.id);
            break;
          case "reject":
            logDiagnostic("action-rejected", `server refused: ${data.reason}`);
            syncRef.current?.handleReject(data.id, data.reason);
            break;
          case "pong":
            missedPongsRef.current = 0;
            break;
        }
      } catch (e) {
        console.warn("failed to handle party socket message", e);
      }
    },
    onClose() {
      setPartyConnectionHealthy(false);
      const stillPending = syncRef.current?.pendingCount ?? 0;
      logDiagnostic(
        "disconnected",
        stillPending
          ? `lost connection with ${stillPending} unsent change(s)`
          : "lost connection",
      );
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
  });

  useEffect(() => {
    setBlockedActionHandler(() => {
      logDiagnostic("action-blocked", "change discarded while disconnected");
      if (inObs) return;
      toaster.show(
        {
          message: t("party.actionBlocked"),
          intent: Intent.WARNING,
        },
        BLOCKED_TOAST_KEY,
      );
    });
    sendFailedToast.current = () => {
      if (inObs) return;
      toaster.show(
        {
          message: t("party.sendFailed"),
          intent: Intent.DANGER,
        },
        SEND_FAILED_TOAST_KEY,
      );
    };
    rejectedToast.current = (reason: string) => {
      // the reason is server-side detail; log it for debugging but keep the
      // toast to something a tournament organizer can act on
      console.warn("event server rejected an action:", reason);
      if (inObs) return;
      toaster.show(
        {
          message: t("party.actionRejected"),
          intent: Intent.DANGER,
        },
        REJECTED_TOAST_KEY,
      );
    };
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
      toaster.dismiss(SEND_FAILED_TOAST_KEY);
      toaster.dismiss(REJECTED_TOAST_KEY);
    };
  }, []);

  useEffect(() => {
    const sync = new SyncManager(socket, {
      dispatchForeign(action) {
        // mark the source so the listener below doesn't send it back out
        dispatch({ ...action, meta: { source: "partykit" } });
      },
      applyState(state) {
        dispatch(receivePartyState(state));
      },
      requestCatchup(since) {
        socket.send(JSON.stringify({ type: "catchup", since }));
      },
      resync() {
        logDiagnostic(
          "resync",
          "missed changes could not be replayed in place",
        );
        socket.reconnect();
      },
      onGiveUp(action) {
        logDiagnostic(
          "action-abandoned",
          `gave up delivering ${String(action.type)} after repeated attempts`,
        );
        sendFailedToast.current();
      },
      onReject(action, reason) {
        logDiagnostic(
          "action-rolled-back",
          `${String(action.type)} was undone (${reason})`,
        );
        rejectedToast.current(reason);
      },
    });
    syncRef.current = sync;
    // let the diagnostics panel read the live pending list without copying it
    setPendingActionsProvider(() => sync.pendingActions);
    const stopListening = startAppListening({
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
        sync.send(action);
      },
    });
    return () => {
      stopListening();
      sync.dispose();
      syncRef.current = null;
      setPendingActionsProvider(undefined);
    };
  }, [socket, dispatch]);

  // mark where a session begins, so a log covering several rooms or a page
  // reload is readable
  useEffect(() => {
    logDiagnostic("session-started", `room ${props.roomName ?? "(none)"}`);
  }, [props.roomName]);

  // Application-level heartbeat: a websocket can stay OPEN while the server is
  // frozen or the TCP link is half-open, in which case nothing surfaces the
  // dead connection until an ack times out. Ping periodically and force a
  // reconnect once too many pongs go unanswered.
  useEffect(() => {
    missedPongsRef.current = 0;
    const interval = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      if (missedPongsRef.current >= MAX_MISSED_PONGS) {
        missedPongsRef.current = 0;
        logDiagnostic(
          "heartbeat-lost",
          `no reply to ${MAX_MISSED_PONGS} pings; forcing a reconnect`,
        );
        socket.reconnect();
        return;
      }
      missedPongsRef.current += 1;
      socket.send(JSON.stringify({ type: "ping" }));
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
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

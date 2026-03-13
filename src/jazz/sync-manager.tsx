/**
 * JazzSyncManager — replaces PartySocketManager
 *
 * Drop-in replacement for `<PartySocketManager roomName={name}>`:
 *  - Shows a loading spinner while the Jazz room is connecting.
 *  - Populates the Redux store with room state (replaces the WS `roomstate` msg).
 *  - Keeps Redux <-> Jazz in sync bidirectionally:
 *      Redux actions  -> Jazz mutations (replaces the WS action broadcast).
 *      Jazz CoValue changes -> Redux state (CRDT-based, no server needed).
 *
 * Room lifecycle:
 *  1. If the roomName is already a Jazz CoValue ID, load it directly.
 *  2. Otherwise, look up a stored Jazz ID in localStorage for that roomName.
 *     If none found, create a new public Jazz room and record the mapping.
 *  3. Once the room CoValue is loaded, render children inside a context that
 *     exposes an invite link for sharing.
 */

import React, { useEffect, useRef, useState } from "react";
import { co } from "jazz-tools";
import { useAccount, useCoState, createInviteLink } from "jazz-tools/react";
import { Card, NonIdealState, Spinner } from "@blueprintjs/core";
import { DelayRender } from "../utils/delay-render";
import { useAppDispatch, useAppStore } from "../state/store";
import { receivePartyState } from "../state/central";
import { startAppListening } from "../state/listener-middleware";
import { applyMigrations } from "../state/migrations";
import {
  AppAccount,
  JazzRoom,
  JazzDrawingList,
  JazzConfigList,
} from "./schema";
import { jazzRoomToAppState, type JazzRoomInstance } from "./converters";
import { applyActionToJazz } from "./room-mutations";
import type { AppState } from "../state/store";

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------

const ROOM_MAP_KEY = "ddrcardraw:jazz-room-ids";

function getStoredRoomId(roomName: string): string | undefined {
  try {
    const map = JSON.parse(localStorage.getItem(ROOM_MAP_KEY) ?? "{}");
    return map[roomName];
  } catch {
    return undefined;
  }
}

function storeRoomId(roomName: string, roomId: string) {
  try {
    const map = JSON.parse(localStorage.getItem(ROOM_MAP_KEY) ?? "{}");
    map[roomName] = roomId;
    localStorage.setItem(ROOM_MAP_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/** Jazz CoValue IDs begin with "co_z" */
export function isJazzId(s: string | undefined): s is string {
  return !!s && s.startsWith("co_z");
}

// ---------------------------------------------------------------------------
// Context — exposes room share info to descendant components
// ---------------------------------------------------------------------------

export const JazzRoomContext = React.createContext<{
  inviteUrl: string | null;
  roomId: string | null;
}>({ inviteUrl: null, roomId: null });

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function JazzSyncManager({
  roomName,
  children,
}: {
  roomName: string;
  children: React.ReactNode;
}) {
  const [roomId, setRoomId] = useState<string | undefined>(() => {
    if (isJazzId(roomName)) return roomName;
    return getStoredRoomId(roomName);
  });

  // useAccount returns the account directly (MaybeLoaded<Account>)
  const me = useAccount(AppAccount);
  const hasCreated = useRef(false);

  useEffect(() => {
    if (roomId || hasCreated.current || !me?.$isLoaded) return;
    hasCreated.current = true;

    // Create a Group with public write access so every browser that has the
    // Jazz CoValue ID can read and write — no sign-in required (like PartyKit).
    const group = co.group().create();
    group.makePublic("writer");

    const drawings = JazzDrawingList.create([], { owner: group });
    const configs = JazzConfigList.create([], { owner: group });

    const room = JazzRoom.create(
      {
        eventName: "",
        cabsJson: JSON.stringify({
          default: { id: "default", name: "Primary Cab", activeMatch: null },
        }),
        obsLabelsJson: JSON.stringify({}),
        obsCss: "h1 {\n  /* add text styles here */\n}",
        drawings,
        configs,
      },
      { owner: group },
    );

    // Jazz CoValues expose their ID via .id (string, prefixed co_z...)
    const jazzId = (room as unknown as { id: string }).id;
    storeRoomId(roomName, jazzId);
    setRoomId(jazzId);
  }, [me, roomId, roomName]);

  if (!roomId) {
    return <ConnectingSpinner />;
  }

  return (
    <RoomLoader roomId={roomId} roomName={roomName}>
      {children}
    </RoomLoader>
  );
}

// ---------------------------------------------------------------------------
// Inner component — subscribes to room and manages Redux sync
// ---------------------------------------------------------------------------

function RoomLoader({
  roomId,
  roomName,
  children,
}: {
  roomId: string;
  roomName: string;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  const room = useCoState(JazzRoom, roomId, {
    resolve: {
      drawings: { $each: true },
      configs: { $each: true },
    },
  });

  // Jazz -> Redux (initial load + remote updates)
  //
  // isApplyingLocalMutation prevents a round-trip: when WE trigger a Jazz
  // mutation, the CoValue subscription may fire synchronously. We skip the
  // redundant dispatch(receivePartyState) in that case.
  const isApplyingLocalMutation = useRef(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!room?.$isLoaded) return;
    if (isApplyingLocalMutation.current) return;

    const appState = jazzRoomToAppState(room as unknown as JazzRoomInstance);

    if (!initialLoadDone.current) {
      // Run data migrations once on initial load (same as PartySocketManager did)
      applyMigrations(appState as AppState);
      initialLoadDone.current = true;
    }

    dispatch(receivePartyState(appState as AppState));
  }, [room, dispatch]);

  // Redux -> Jazz (outgoing mutations)
  useEffect(() => {
    if (!room?.$isLoaded) return;

    return startAppListening({
      predicate(action) {
        // Never feed receivePartyState back to Jazz (would loop)
        if (receivePartyState.match(action)) return false;
        // Skip actions tagged as originating from Jazz
        if ((action as { meta?: { source?: string } }).meta?.source === "jazz")
          return false;
        return true;
      },
      effect(action) {
        if (!room?.$isLoaded) return;

        isApplyingLocalMutation.current = true;
        try {
          applyActionToJazz(action, room as unknown as JazzRoomInstance);
        } finally {
          // Reset on the next microtask so synchronous Jazz subscription
          // callbacks triggered inside applyActionToJazz are still suppressed.
          Promise.resolve().then(() => {
            isApplyingLocalMutation.current = false;
          });
        }
      },
    });
  }, [room, store]);

  // Invite link for sharing
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!room?.$isLoaded) return;
    try {
      const url = createInviteLink(
        room as unknown as import("jazz-tools").CoValue,
        "writer",
      );
      setInviteUrl(url);
    } catch {
      // createInviteLink may throw if the room's Group doesn't support invites
    }
  }, [room]);

  if (!room?.$isLoaded) {
    return <ConnectingSpinner />;
  }

  return (
    <JazzRoomContext.Provider value={{ inviteUrl, roomId }}>
      {children}
    </JazzRoomContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Loading UI
// ---------------------------------------------------------------------------

function ConnectingSpinner() {
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

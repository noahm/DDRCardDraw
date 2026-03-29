/**
 * Jazz Room Context
 *
 * Replaces the old JazzSyncManager + Redux Provider.
 * Provides the loaded JazzRoom (and owner Group) via React context.
 * No Redux, no bidirectional sync — components read Jazz directly.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { co, type Group } from "jazz-tools";
import { useAccount, useCoState, createInviteLink } from "jazz-tools/react";
import { Card, NonIdealState, Spinner } from "@blueprintjs/core";
import { DelayRender } from "../utils/delay-render";
import {
  AppAccount,
  JazzRoom,
  JazzDrawingList,
  JazzConfigList,
  JazzCab,
  JazzCabRecord,
  JazzObsLabelRecord,
} from "./schema";
import type { JazzRoomInstance } from "./converters";

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
    // localStorage unavailable
  }
}

export function isJazzId(s: string | undefined): s is string {
  return !!s && s.startsWith("co_z");
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface RoomContextValue {
  room: JazzRoomInstance;
  owner: Group;
  roomId: string;
  roomName: string;
  inviteUrl: string | null;
}

export const RoomContext = createContext<RoomContextValue | null>(null);

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom() called outside <RoomProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

export function RoomProvider({
  roomName,
  children,
}: {
  roomName: string;
  children: React.ReactNode;
}) {
  const [roomId, setRoomId] = useState<string | undefined>(() =>
    isJazzId(roomName) ? roomName : getStoredRoomId(roomName),
  );

  const me = useAccount(AppAccount);
  const hasCreated = useRef(false);

  useEffect(() => {
    if (roomId || hasCreated.current || !me?.$isLoaded) return;
    hasCreated.current = true;

    const group = co.group().create();
    group.makePublic("writer");

    const drawings = JazzDrawingList.create([], { owner: group });
    const configs = JazzConfigList.create([], { owner: group });

    const defaultCab = JazzCab.create(
      { id: "default", name: "Primary Cab", activeMatchJson: null },
      { owner: group },
    );
    const cabs = JazzCabRecord.create({}, { owner: group });
    (cabs as unknown as { $jazz: { set(k: string, v: unknown): void } }).$jazz.set(
      "default",
      defaultCab,
    );
    const obsLabels = JazzObsLabelRecord.create({}, { owner: group });

    const room = JazzRoom.create(
      {
        eventName: "",
        obsCss: "h1 {\n  /* add text styles here */\n}",
        drawings,
        configs,
        cabs,
        obsLabels,
      },
      { owner: group },
    );

    const jazzId = (room as unknown as { id: string }).id;
    storeRoomId(roomName, jazzId);
    setRoomId(jazzId);
  }, [me, roomId, roomName]);

  if (!roomId) return <ConnectingSpinner />;

  return (
    <RoomLoader roomId={roomId} roomName={roomName}>
      {children}
    </RoomLoader>
  );
}

// ---------------------------------------------------------------------------
// Inner loader — subscribes to the room CoValue
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
  const room = useCoState(JazzRoom, roomId, {
    resolve: {
      drawings: {
        $each: {
          winners: true,
          bans: { $each: true },
          protects: { $each: true },
          pocketPicks: { $each: true },
          subDrawings: { $each: true },
        },
      },
      configs: { $each: true },
      cabs: { $each: true },
      obsLabels: { $each: true },
    },
  });

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!room?.$isLoaded) return;
    try {
      setInviteUrl(
        createInviteLink(room as unknown as import("jazz-tools").CoValue, "writer"),
      );
    } catch {
      // group may not support invite links
    }
  }, [room]);

  if (!room?.$isLoaded) return <ConnectingSpinner />;

  const owner = (room as unknown as { owner: Group }).owner;

  return (
    <RoomContext.Provider
      value={{
        room: room as unknown as JazzRoomInstance,
        owner,
        roomId,
        roomName,
        inviteUrl,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Loading UI
// ---------------------------------------------------------------------------

function ConnectingSpinner() {
  return (
    <section style={{ display: "flex", justifyContent: "center", marginTop: "15vh" }}>
      <DelayRender>
        <Card elevation={2} style={{ maxWidth: "30rem" }}>
          <NonIdealState icon={<Spinner />} title="Connecting..." />
        </Card>
      </DelayRender>
    </section>
  );
}

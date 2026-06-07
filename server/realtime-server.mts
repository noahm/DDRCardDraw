/**
 * Self-hosted websocket backend that keeps a per-room copy of redux state in
 * sync across connected clients.
 *
 * Each room maintains its own redux store. When a client sends a redux
 * action, the server rebroadcasts it to every other connection in the room,
 * applies it to the room's store, and persists the resulting state. New
 * connections are sent the room's current state to bootstrap them.
 *
 * Usage: `node server/run.mjs` (registered as `yarn start:backend`), which
 * bundles this file before running it — see run.mjs for why.
 */
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { nanoid } from "nanoid";
import { configureStore } from "@reduxjs/toolkit";
import { createClient } from "@supabase/supabase-js";
import { reducer } from "../src/state/root-reducer.ts";
import { applyMigrations } from "../src/state/migrations.ts";
import type { AppState } from "../src/state/store.ts";
import type { Broadcast, ReduxAction } from "../src/realtime/types.ts";
import type { Database, Json } from "./database.types.ts";

const PORT = Number(process.env.PORT) || 1999;
const ROOM_PATH = /^\/parties\/main\/([^/?]+)/;
const STATE_DIR = join(process.cwd(), ".room-state");

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.log(
      "Both SUPABASE_URL and SUPABASE_KEY are needed for persistence to supabase.",
    );
    console.log("Disabling supabase persistence.");
    return;
  }
  return createClient<Database>(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
    { auth: { persistSession: false } },
  );
}

const supabase = getSupabase();

function isAppState(state: unknown): state is AppState {
  if (state && !Array.isArray(state) && typeof state === "object") {
    return "config" in state && "drawings" in state;
  }
  return false;
}

function roomStateFile(roomId: string) {
  return join(STATE_DIR, `${encodeURIComponent(roomId)}.json`);
}

async function readLocalState(roomId: string): Promise<AppState | undefined> {
  try {
    const raw = await readFile(roomStateFile(roomId), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (isAppState(parsed)) return parsed;
  } catch {
    // no local state file yet
  }
}

async function writeLocalState(roomId: string, state: AppState) {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(roomStateFile(roomId), JSON.stringify(state), "utf-8");
}

async function readSupabaseState(
  roomId: string,
): Promise<AppState | undefined> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("event_state")
    .select("state")
    .eq("id", roomId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (data && isAppState(data.state)) return data.state;
}

async function persistState(roomId: string, state: AppState) {
  try {
    await writeLocalState(roomId, state);
  } catch (e) {
    console.warn(`failed to persist state for room "${roomId}" to disk`, e);
  }
  try {
    if (supabase) {
      await supabase.from("event_state").upsert({
        id: roomId,
        state: state as unknown as Json,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn(`failed to persist state for room "${roomId}" to supabase`, e);
  }
}

function createRoomStore(preloadedState?: AppState) {
  return preloadedState
    ? configureStore({ reducer, preloadedState })
    : configureStore({ reducer });
}

interface Room {
  store: ReturnType<typeof createRoomStore>;
  connections: Map<string, WebSocket>;
}

const rooms = new Map<string, Room>();

async function getRoom(roomId: string): Promise<Room> {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  let preloadedState: AppState | undefined;
  try {
    preloadedState =
      (await readLocalState(roomId)) ?? (await readSupabaseState(roomId));
    if (preloadedState) applyMigrations(preloadedState);
  } catch (e) {
    console.warn(`failed to load existing state for room "${roomId}"`, e);
  }

  const room: Room = {
    store: createRoomStore(preloadedState),
    connections: new Map(),
  };
  rooms.set(roomId, room);
  return room;
}

function send(ws: WebSocket, message: Broadcast) {
  ws.send(JSON.stringify(message));
}

function roomIdFromUrl(url: string | undefined): string | undefined {
  const match = url && ROOM_PATH.exec(url);
  if (match) return decodeURIComponent(match[1]);
}

function onConnect(ws: WebSocket, roomId: string, room: Room) {
  const connectionId = nanoid();
  room.connections.set(connectionId, ws);
  console.log(
    `connected: id=${connectionId} room=${roomId} (${room.connections.size} connection(s) now)`,
  );

  send(ws, { type: "roomstate", state: room.store.getState() });

  ws.on("message", (data: RawData) => {
    const message = data.toString();

    // broadcast it to all the other connections in the room...
    for (const [id, connection] of room.connections) {
      if (id !== connectionId && connection.readyState === WebSocket.OPEN) {
        connection.send(message);
      }
    }

    let parsed: ReduxAction;
    try {
      parsed = JSON.parse(message);
    } catch (e) {
      console.warn("failed to parse incoming message as JSON", e);
      return;
    }

    // resolve the new state and persist it
    room.store.dispatch(parsed.action);
    void persistState(roomId, room.store.getState());
  });

  ws.on("close", () => {
    room.connections.delete(connectionId);
    console.log(
      `disconnected: id=${connectionId} room=${roomId} (${room.connections.size} connection(s) left)`,
    );
  });
}

const httpServer = createServer((req, res) => {
  const roomId = req.method === "GET" ? roomIdFromUrl(req.url) : undefined;
  if (!roomId) {
    res.writeHead(404);
    res.end();
    return;
  }
  void getRoom(roomId).then((room) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(room.store.getState()));
  });
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  const roomId = roomIdFromUrl(req.url);
  if (!roomId) {
    socket.destroy();
    return;
  }
  void getRoom(roomId).then((room) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      onConnect(ws, roomId, room);
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`realtime server listening on http://localhost:${PORT}`);
});

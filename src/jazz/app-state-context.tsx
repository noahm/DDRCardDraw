/**
 * App State Context
 *
 * Derives a plain AppState object from the live Jazz room and makes it
 * available via `useRoomState()` — a drop-in replacement for `useAppState()`
 * that requires no Redux.
 *
 * The context value is recomputed whenever the Jazz room updates (the
 * RoomProvider's useCoState subscription fires).  All consumers re-render
 * on any change; this matches the behaviour of the previous Redux + receivePartyState
 * approach.
 */

import { createContext, useContext } from "react";
import type { Drawing } from "../models/Drawing";
import type { ConfigState } from "../state/config.slice";
import type { EventState } from "../state/event.slice";
import { useRoom } from "./room-context";
import { jazzRoomToAppState } from "./converters";

// ---------------------------------------------------------------------------
// AppState shape (no Redux dependency)
// ---------------------------------------------------------------------------

export interface AppState {
  config: {
    ids: string[];
    entities: Record<string, ConfigState>;
  };
  drawings: {
    ids: string[];
    entities: Record<string, Drawing>;
  };
  event: EventState;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Derive a plain AppState from the current Jazz room and select a value.
 * Replaces `useAppState(selector)` from react-redux.
 *
 * Note: The entire state is recomputed on every room update.  For
 * performance-sensitive paths, use the raw Jazz CoValue instances from
 * useRoom() and narrow the subscription with additional useCoState() calls.
 */
export function useRoomState<T>(selector: (state: AppState) => T): T {
  const { room } = useRoom();
  const state = jazzRoomToAppState(room) as AppState;
  return selector(state);
}

// Re-export so callers can keep the same import paths.
export type { ConfigState, EventState };

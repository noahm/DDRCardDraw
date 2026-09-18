import type { Middleware } from "@reduxjs/toolkit";
import {
  isPartyConnectionHealthy,
  reportBlockedAction,
} from "../party/connection-status";
import { receivePartyState } from "./central";

/**
 * Drops locally-dispatched actions while the partykit websocket is down,
 * so local state can't silently drift from the shared room state.
 */
export const partyGateMiddleware: Middleware = () => (next) => (action) => {
  if (isPartyConnectionHealthy()) {
    return next(action);
  }
  // always let server-originated messages through, in case any arrive
  // before the reconnect handler flips the flag back
  if (
    receivePartyState.match(action) ||
    (action as { meta?: { source?: string } }).meta?.source === "partykit"
  ) {
    return next(action);
  }
  reportBlockedAction();
};

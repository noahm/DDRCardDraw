/**
 * JazzProvider
 *
 * Wraps the entire app with the Jazz React context.  The provider:
 * - Runs in `guestMode` (no sign-in required, matching PartyKit's anonymous model)
 * - Connects to Jazz Cloud for real-time sync (replaces the PartyKit WebSocket)
 * - Persists each anonymous session's identity in localStorage
 *
 * Usage:
 *   <JazzProvider>
 *     <App />
 *   </JazzProvider>
 *
 * To use your own Jazz Cloud API key, set JAZZ_API_KEY in the environment or
 * replace the `peer` URL below.  The default key is a demo key that works for
 * development but has rate limits.
 */

import React from "react";
import { JazzReactProvider } from "jazz-tools/react";
import { AppAccount } from "./schema";

const JAZZ_SYNC_PEER =
  process.env.JAZZ_API_KEY
    ? `wss://cloud.jazz.tools/?key=${process.env.JAZZ_API_KEY}`
    : "wss://cloud.jazz.tools/?key=ddrcardraw-dev-preview";

export function JazzProvider({ children }: { children: React.ReactNode }) {
  return (
    <JazzReactProvider
      // Guest mode: every browser gets a persistent anonymous account stored
      // in localStorage.  No sign-in flow needed — same as PartyKit.
      guestMode
      sync={{ peer: JAZZ_SYNC_PEER as `wss://${string}`, when: "always" }}
      AccountSchema={AppAccount}
    >
      {children}
    </JazzReactProvider>
  );
}

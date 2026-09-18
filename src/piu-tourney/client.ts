import { createClient } from "@supabase/supabase-js";
import { piuTourneyCredentials } from "./config";
import type { Database } from "./database.types";

/**
 * Read-only client for the piu-tourney-maker Supabase project.
 *
 * Credentials come from ./config, which is deliberately importable on its own:
 * this module pulls in @supabase/supabase-js, so it is only reached through a
 * lazily loaded chunk.
 *
 * Null when the build had no credentials, so the UI can say "not configured"
 * instead of throwing at import time.
 */
export const piuClient = buildClient();

function buildClient() {
  if (!piuTourneyCredentials) {
    return null;
  }
  const { url, anonKey } = piuTourneyCredentials;
  return createClient<Database>(url, anonKey, {
    // nothing in this app ever signs in to tourney-maker, and persisting a
    // session would collide with the partykit client's storage keys
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

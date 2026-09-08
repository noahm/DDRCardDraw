import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Read-only client for the piu-tourney-maker Supabase project.
 *
 * Both values are baked in at build time by webpack's DefinePlugin. They are
 * deliberately distinct from `SUPABASE_URL`/`SUPABASE_KEY`, which belong to
 * this app's own partykit persistence project (see src/party/server.ts).
 *
 * A Supabase anon key is public by design — it identifies the project, and
 * row-level security is what actually decides what a caller may read. We never
 * sign in and never write, so this client only ever sees what an anonymous
 * visitor to tourney-maker's own spectator pages sees.
 *
 * Null when the build had no credentials, so the UI can say "not configured"
 * instead of throwing at import time.
 */
export const piuClient = buildClient();

/** Whether this build can offer tourney maker as a draw source at all. */
export const piuTourneyEnabled = !!piuClient;

function buildClient() {
  const url = process.env.PIU_TOURNEY_SUPABASE_URL as string | undefined;
  const anonKey = process.env.PIU_TOURNEY_SUPABASE_ANON_KEY as
    | string
    | undefined;
  if (!url || !anonKey) {
    if (url || anonKey) {
      // half-configured is a build mistake rather than an opt-out, and would
      // otherwise look identical to not wanting the feature
      console.warn(
        "piu-tourney: ignoring partial config — set both PIU_TOURNEY_SUPABASE_URL and PIU_TOURNEY_SUPABASE_ANON_KEY",
      );
    }
    return null;
  }
  return createClient<Database>(url, anonKey, {
    // nothing in this app ever signs in to tourney-maker, and persisting a
    // session would collide with the partykit client's storage keys
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

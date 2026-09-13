/**
 * Build-time configuration for the tourney-maker draw source, kept apart from
 * the client so that asking *whether* the feature exists doesn't drag
 * @supabase/supabase-js into the bundle importing it.
 *
 * Anything that only needs to know the feature is available should import from
 * here; only code that actually talks to Supabase should import ./client.
 */

const url = process.env.PIU_TOURNEY_SUPABASE_URL as string | undefined;
const anonKey = process.env.PIU_TOURNEY_SUPABASE_ANON_KEY as string | undefined;

/**
 * A Supabase anon key is public by design — it identifies the project, and
 * row-level security decides what a caller may read. We never sign in and never
 * write, so this only ever sees what an anonymous visitor to tourney-maker's
 * own spectator pages sees.
 */
export const piuTourneyCredentials = url && anonKey ? { url, anonKey } : null;

/** Whether this build can offer tourney maker as a draw source at all. */
export const piuTourneyEnabled = !!piuTourneyCredentials;

if (!piuTourneyCredentials && (url || anonKey)) {
  // half-configured is a build mistake rather than an opt-out, and would
  // otherwise look identical to not wanting the feature
  console.warn(
    "piu-tourney: ignoring partial config — set both PIU_TOURNEY_SUPABASE_URL and PIU_TOURNEY_SUPABASE_ANON_KEY",
  );
}

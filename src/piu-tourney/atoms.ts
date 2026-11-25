import { atomWithStorage } from "jotai/utils";

/**
 * Device-local selection state. Separate from ./index so the settings tab can
 * read it without pulling in the Supabase client, which is a lazily loaded
 * chunk of its own.
 */

/**
 * Which tourney-maker tournament this device draws from. Stored per-device like
 * the start.gg slug, not synced through partykit.
 *
 * tourney-maker addresses everything by bare bigint id — no slugs, no uuids.
 */
export const piuTourneyIdAtom = atomWithStorage<number | null>(
  "ddrtools.event.piutourneyid",
  null,
  undefined,
  { getOnInit: true },
);

/** Accepts a tourney-maker URL (…/tourney/123/whatever) or a bare id. */
export function parseTourneyId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/\/tourney\/(\d+)/);
  const id = Number(fromUrl ? fromUrl[1] : trimmed);
  return Number.isInteger(id) && id > 0 ? id : null;
}

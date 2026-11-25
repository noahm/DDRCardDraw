import { useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback } from "react";
import { normalizeHandle } from "../utils/smx-scores";

/**
 * Which StepManiaX gamer tag belongs to which player, learned whenever an
 * operator confirms a play during a score import (see
 * ../tournament-mode/smx-score-import).
 *
 * Keyed by the player's name rather than their id, so a tag confirmed in one
 * bracket still matches the same person in the next one — entrant ids are
 * minted per event, names travel. Stored per-device like the start.gg key, not
 * synced through partykit: it's a habit of the machine running the draws, not
 * state of any one event.
 */
const smxUsernamesAtom = atomWithStorage<Record<string, string>>(
  "ddrtools.smxUsernames",
  {},
  undefined,
  { getOnInit: true },
);

/** map of normalized player name to that player's SMX gamer tag */
export function useSmxUsernames() {
  return useAtomValue(smxUsernamesAtom);
}

/**
 * Records the gamer tag an operator confirmed for a player. A player with no
 * name is skipped — their positional placeholder (`P1`) identifies a seat, not
 * a person, and would hand the tag to whoever sits there next.
 */
export function useLinkSmxUsername() {
  const setUsernames = useSetAtom(smxUsernamesAtom);
  return useCallback(
    (playerName: string, smxUsername: string) => {
      const key = normalizeHandle(playerName);
      if (!key || !smxUsername) {
        return;
      }
      setUsernames((prev) =>
        prev[key] === smxUsername ? prev : { ...prev, [key]: smxUsername },
      );
    },
    [setUsernames],
  );
}

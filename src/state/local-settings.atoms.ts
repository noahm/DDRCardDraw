import { useAtomValue, useSetAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { useCallback, useMemo } from "react";
import { useRoomName } from "../hooks/useRoomName";

/**
 * Settings each browser answers for itself.
 *
 * `EventSettings` belong to the room: one value, synced to everyone connected,
 * so an organizer states a rule once and it holds for the whole event. These
 * are the opposite, and two people in the same room disagreeing is the point.
 * Whether a banned chart is worth looking at depends on who is looking — the
 * stream wants the bans on screen for viewers while the person running the cab
 * wants them out of the way — and neither answer is the room's to impose.
 *
 * Keyed by room the way a config selection is: a stream room and the practice
 * room next to it are different events, and don't want the same answers.
 *
 * An OBS source is the one client with nobody to set these: it's a browser in
 * a scene that no one ever opens settings in. Those say what they want in
 * their URL instead — see `src/obs-sources/card-options.ts`.
 */
export interface LocalSettings {
  /** hide the charts a match has banned */
  hideVetos: boolean;
}

export const defaultLocalSettings: LocalSettings = {
  hideVetos: false,
};

const localSettingsByRoom = atomFamily((roomName: string) =>
  atomWithStorage<LocalSettings>(
    `ddrtools.localSettings:${roomName}`,
    defaultLocalSettings,
    undefined,
    { getOnInit: true },
  ),
);

/**
 * This browser's settings for the room it's in. Spread over the defaults so a
 * blob stored before a setting existed still answers for it, rather than
 * handing back `undefined` for a boolean the UI will render.
 */
export function useLocalSettings(): LocalSettings {
  const roomName = useRoomName();
  const stored = useAtomValue(localSettingsByRoom(roomName));
  return useMemo(() => ({ ...defaultLocalSettings, ...stored }), [stored]);
}

export function useUpdateLocalSettings() {
  const roomName = useRoomName();
  const setStored = useSetAtom(localSettingsByRoom(roomName));
  return useCallback(
    (patch: Partial<LocalSettings>) =>
      setStored((prev) => ({ ...defaultLocalSettings, ...prev, ...patch })),
    [setStored],
  );
}

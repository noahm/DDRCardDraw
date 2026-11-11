import { useAtomValue, useSetAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { useRoomName } from "../hooks/useRoomName";

/**
 * Which cab new draws get assigned to, if any. Device-local and per-room like
 * the last config selected, rather than synced through partykit: two laptops
 * running the same event each want the cab sitting in front of them.
 */
const lastCabSelectedByEvent = atomFamily((roomName: string) =>
  atomWithStorage<string | undefined>(
    `ddrtools.lastCabSelected:${roomName}`,
    undefined,
    undefined,
    { getOnInit: true },
  ),
);

export function useLastCabSelected() {
  const roomName = useRoomName();
  return useAtomValue(lastCabSelectedByEvent(roomName));
}

export function useSetLastCabSelected() {
  const roomName = useRoomName();
  return useSetAtom(lastCabSelectedByEvent(roomName));
}

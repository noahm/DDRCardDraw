import { useAtomValue, useSetAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { useRoomName } from "../hooks/useRoomName";

const lastConfigSelectedByEvent = atomFamily((roomName: string) =>
  atomWithStorage<string | undefined>(
    `ddrtools.lastConfigSelected:${roomName}`,
    undefined,
    undefined,
    { getOnInit: true },
  ),
);

export function useLastConfigSelected() {
  const roomName = useRoomName();
  return useAtomValue(lastConfigSelectedByEvent(roomName));
}

export function useSetLastConfigSelected() {
  const roomName = useRoomName();
  return useSetAtom(lastConfigSelectedByEvent(roomName));
}

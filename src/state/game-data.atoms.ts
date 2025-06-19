import { atom, getDefaultStore, useAtomValue, useSetAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { GameData } from "../models/SongData";
import { useEffect } from "react";
import { useRoomName } from "../hooks/useRoomName";

const lastGameSelectedByEvent = atomFamily((roomName: string) =>
  atomWithStorage<string | undefined>(
    `ddrtools.lastGameSelected:${roomName}`,
    undefined,
    undefined,
    { getOnInit: true },
  ),
);

export function useLastGameSelected() {
  const roomName = useRoomName();
  return useAtomValue(lastGameSelectedByEvent(roomName));
}

export function useSetLastGameSelected() {
  const roomName = useRoomName();
  return useSetAtom(lastGameSelectedByEvent(roomName));
}

/** should be the return value from `useRoomName` */
export function getLastGameSelected(roomName: string) {
  const jotaiStore = getDefaultStore();
  return jotaiStore.get(lastGameSelectedByEvent(roomName));
}

export const stockDataCache = atom<Record<string, GameData>>({});
export const customDataCache = atom<Record<string, GameData>>({});

export const stockDataByName = atomFamily((name: string) =>
  atom((get) => get(stockDataCache)[name]),
);

export async function loadStockGamedataByName(name: string) {
  const jotaiStore = getDefaultStore();
  const cache = jotaiStore.get(stockDataCache);
  if (cache[name]) {
    return cache[name];
  }

  try {
    const data = (
      await import(/* webpackChunkName: "songData" */ `../songs/${name}.json`)
    ).default as GameData;
    jotaiStore.set(stockDataCache, (prev) => {
      return {
        ...prev,
        [name]: data,
      };
    });
    return data;
  } catch {
    console.warn(`failed to load song data with key '${name}'`);
  }
}

export function useStockGameData(name: string): GameData | null {
  const data = useAtomValue(stockDataByName(name));
  useEffect(() => {
    if (!data && name) {
      loadStockGamedataByName(name);
    }
  }, [data, name]);
  return data || null;
}

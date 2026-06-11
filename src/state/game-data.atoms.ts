import { atom, getDefaultStore, useAtomValue, useSetAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { GameData } from "../models/SongData";
import { useEffect } from "react";
import { useRoomName } from "../hooks/useRoomName";
import { useAppState } from "./store";
import type { AppState } from "./root-reducer";

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

export const stockDataByName = atomFamily((name: string) =>
  atom((get) => get(stockDataCache)[name]),
);

/** looks up game data by key, checking room-synced custom data before falling back to bundled stock data */
export async function loadGameDataByKey(
  state: AppState,
  name: string,
): Promise<GameData | undefined> {
  return state.customGameData[name] ?? (await loadStockGamedataByName(name));
}

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
      void loadStockGamedataByName(name);
    }
  }, [data, name]);
  return data || null;
}

/** looks up game data by key, preferring room-synced custom data over bundled stock data */
export function useGameData(name: string): GameData | null {
  const customData = useAppState((s) => s.customGameData[name]);
  const stockData = useStockGameData(customData ? "" : name);
  return customData || stockData;
}

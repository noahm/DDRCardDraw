import { atom, getDefaultStore, useAtomValue } from "jotai";
import { GameData } from "../models/SongData";
import { useEffect } from "react";
import { atomFamily } from "jotai/utils";

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

import { atom, getDefaultStore, useAtomValue } from "jotai";
import { GameData } from "../models/SongData";
import { startAppListening } from "./listener-middleware";
import { useEffect } from "react";
import { atomFamily } from "jotai/utils";

export const gameDataAtom = atom<GameData | null>(null);

export const gameDataLoadingStatus = atom<
  "loading" | "failed" | "pending" | "available"
>("pending");

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
}

export function useStockGameData(name: string): GameData | null {
  const data = useAtomValue(stockDataByName(name));
  useEffect(() => {
    if (!data) {
      loadStockGamedataByName(name);
    }
  }, [data, name]);
  return data || null;
}

startAppListening({
  predicate(action, currentState, originalState) {
    if (currentState.gameData !== originalState.gameData) {
      return true;
    }
    return false;
  },
  async effect(action, api) {
    console.debug("running game-data.atoms effect");
    const newState = api.getState().gameData;
    if (!newState.dataSetName) {
      console.debug("no data selected, not loading anything");
      return;
    }
    const jotaiStore = getDefaultStore();
    let newData: GameData | undefined;
    if (newState.dataType === "stock") {
      console.debug("stock data");
      jotaiStore.set(gameDataLoadingStatus, "loading");
      try {
        newData = await loadStockGamedataByName(newState.dataSetName);
      } catch (e) {
        console.error("stock data fetch failed", { cause: e });
        jotaiStore.set(gameDataLoadingStatus, "failed");
        return;
      }
    } else {
      console.debug("custom data");
      const customData = jotaiStore.get(customDataCache);
      if (customData[newState.dataSetName]) {
        newData = customData[newState.dataSetName];
      }
    }
    if (newData) {
      console.log("data arrived", { newData });
      jotaiStore.set(gameDataAtom, newData);
      jotaiStore.set(gameDataLoadingStatus, "available");
    } else {
      console.log("data did not arrive");
      jotaiStore.set(gameDataLoadingStatus, "failed");
    }
  },
});

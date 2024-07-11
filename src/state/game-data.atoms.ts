import { atom, getDefaultStore } from "jotai";
import { GameData } from "../models/SongData";
import { startAppListening } from "./listener-middleware";
import { configSlice } from "./config.slice";

export const gameDataAtom = atom<GameData | null>(null);

export const gameDataLoadingStatus = atom<
  "loading" | "failed" | "pending" | "available"
>("pending");

export const customDataCache = atom<Record<string, GameData>>({});

async function loadStockGamedataByName(name: string) {
  return (
    await import(/* webpackChunkName: "songData" */ `../songs/${name}.json`)
  ).default as GameData;
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
      api.dispatch(
        configSlice.actions.applyDefaults({
          supportsGranular: !!newData.meta.granularTierResolution,
          ...newData.defaults,
        }),
      );
      jotaiStore.set(gameDataLoadingStatus, "available");
    } else {
      console.log("data did not arrive");
      jotaiStore.set(gameDataLoadingStatus, "failed");
    }
  },
});

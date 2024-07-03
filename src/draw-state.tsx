import { ReactNode, useEffect } from "react";
import { UnloadHandler } from "./unload-handler";
import { draw } from "./card-draw";
import { Drawing } from "./models/Drawing";
import FuzzySearch from "fuzzy-search";
import { requestIdleCallback, cancelIdleCallback } from "./utils/idle-callback";
import { GameData, I18NDict, Song } from "./models/SongData";
import i18nData from "./assets/i18n.json";
import { availableGameData, detectedLanguage } from "./utils";
import { ConfigState } from "./config-state";
import { IntlProvider } from "./intl-provider";
import type { StoreApi } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { sendToParty } from "./party/client";

interface DrawState {
  importedData: Map<string, GameData>;
  gameData: GameData | null;
  fuzzySearch: FuzzySearch<Song> | null;
  drawings: Drawing[];
  dataSetName: string;
  lastDrawFailed: boolean;
  addImportedData(dataSetName: string, gameData: GameData): void;
  loadGameData(dataSetName: string, gameData?: GameData): Promise<GameData>;
  /** returns false if no songs could be drawn */
  drawSongs(config: ConfigState): boolean;
  clearDrawings(): void;
}

function applyNewData(data: GameData, set: StoreApi<DrawState>["setState"]) {
  set({
    gameData: data,
    drawings: [],
    fuzzySearch: new FuzzySearch(
      data.songs,
      [
        "name",
        "name_translation",
        "search_hint",
        "artist",
        "artist_translation",
      ],
      {
        sort: true,
      },
    ),
  });
}

export const useDrawState = createWithEqualityFn<DrawState>(
  (set, get) => ({
    importedData: new Map(),
    gameData: null,
    fuzzySearch: null,
    drawings: [],
    dataSetName: "",
    lastDrawFailed: false,
    clearDrawings() {
      if (
        get().drawings.length &&
        !window.confirm("This will clear all songs drawn so far. Confirm?")
      ) {
        return;
      }
      set({ drawings: [] });
    },
    addImportedData(dataSetName, gameData) {
      const { importedData } = get();
      const nextData = new Map(importedData);
      nextData.set(dataSetName, gameData);
      set({
        importedData: nextData,
        dataSetName,
      });
      writeDataSetToUrl(dataSetName);
      applyNewData(gameData, set);
    },
    async loadGameData(dataSetName: string, gameData?: GameData) {
      const state = get();
      if (state.dataSetName === dataSetName && state.gameData) {
        return state.gameData;
      }
      if (
        state.drawings.length &&
        !window.confirm("This will clear all songs drawn so far. Confirm?")
      ) {
        return state.gameData;
      }
      set({
        gameData: null,
        dataSetName,
        drawings: [],
      });
      sendToParty({
        type: "dataSet",
        data: dataSetName,
      });
      writeDataSetToUrl(dataSetName);

      // Attempt to look up a local data file first
      gameData = state.importedData.get(dataSetName);

      const data =
        gameData ||
        (
          await import(
            /* webpackChunkName: "songData" */ `./songs/${dataSetName}.json`
          )
        ).default;
      applyNewData(data, set);
      return data;
    },
    drawSongs(config: ConfigState) {
      const state = get();
      if (!state.gameData) {
        return false;
      }

      const drawing = draw(state.gameData, config);
      if (!drawing.charts.length) {
        set({
          lastDrawFailed: true,
        });
        return false;
      }

      set((prevState) => {
        return {
          drawings: [drawing, ...prevState.drawings].filter(Boolean),
          lastDrawFailed: false,
        };
      });
      sendToParty({ type: "drawings", drawings: get().drawings });
      return true;
    },
  }),
  Object.is,
);

interface Props {
  defaultDataSet: string;
  children: ReactNode;
}

function getInitialDataSet(defaultDataName: string) {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("game-")) {
    const targetData = hash.slice(5);
    if (availableGameData.some((d) => d.name === targetData)) {
      return targetData;
    }
  }
  if (
    defaultDataName &&
    availableGameData.some((d) => d.name === defaultDataName)
  ) {
    return defaultDataName;
  }
  return availableGameData[0].name;
}

function writeDataSetToUrl(game: string) {
  const nextHash = `game-${game}`;
  if ("#" + nextHash !== window.location.hash) {
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = encodeURIComponent(nextHash);
    window.history.replaceState(undefined, "", nextUrl);
  }
}

export function DrawStateManager(props: Props) {
  const [gameData, hasDrawings, loadGameData] = useDrawState(
    (state) => [state.gameData, !!state.drawings.length, state.loadGameData],
    shallow,
  );
  useEffect(() => {
    const idleHandle = requestIdleCallback(() =>
      loadGameData(getInitialDataSet(props.defaultDataSet)),
    );
    return () => cancelIdleCallback(idleHandle);
  }, [loadGameData, props.defaultDataSet]);

  return (
    <IntlProvider
      locale={detectedLanguage}
      translations={i18nData as Record<string, I18NDict>}
      mergeTranslations={gameData?.i18n}
    >
      <UnloadHandler confirmUnload={hasDrawings} />
      {props.children}
    </IntlProvider>
  );
}

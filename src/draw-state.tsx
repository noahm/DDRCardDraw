import { ReactNode, useEffect } from "react";
import { UnloadHandler } from "./unload-handler";
import { draw } from "./card-draw";
import { Drawing } from "./models/Drawing";
import FuzzySearch from "fuzzy-search";
import { GameData, I18NDict, Song } from "./models/SongData";
import i18nData from "./assets/i18n.json";
import { availableGameData, detectedLanguage } from "./utils";
import { ApplyDefaultConfig } from "./apply-default-config";
import { ConfigState } from "./config-state";
import { IntlProvider } from "./intl-provider";
import { create, StoreApi } from "zustand";
import { shallow } from "zustand/shallow";
import { DataConnection } from "peerjs";

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
  injectRemoteDrawing(d: Drawing, syncWithPeer?: DataConnection): void;
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

export const useDrawState = create<DrawState>((set, get) => ({
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
    return true;
  },
  injectRemoteDrawing(drawing, syncWithPeer) {
    set((prevState) => {
      const currentDrawing = prevState.drawings.find(
        (d) => d.id === drawing.id,
      );
      const newDrawings = prevState.drawings.filter((d) => d.id !== drawing.id);
      newDrawings.unshift(drawing);
      if (currentDrawing) {
        drawing.__syncPeer = currentDrawing.__syncPeer;
      }
      if (syncWithPeer) {
        drawing.__syncPeer = syncWithPeer;
      }
      return {
        drawings: newDrawings,
      };
    });
  },
}));

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
    loadGameData(getInitialDataSet(props.defaultDataSet));
  }, [loadGameData, props.defaultDataSet]);

  return (
    <IntlProvider
      locale={detectedLanguage}
      translations={i18nData as Record<string, I18NDict>}
      mergeTranslations={gameData?.i18n}
    >
      <ApplyDefaultConfig defaults={gameData?.defaults} />
      <UnloadHandler confirmUnload={hasDrawings} />
      {props.children}
    </IntlProvider>
  );
}

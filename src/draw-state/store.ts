import { draw } from "../card-draw";
import { Drawing } from "../models/Drawing";
import FuzzySearch from "fuzzy-search";
import { GameData, Song } from "../models/SongData";
import { ConfigState } from "../config-state";
import type { StoreApi } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { DataConnection } from "peerjs";

interface DrawState {
  importedData: Map<string, GameData>;
  gameData: GameData | null;
  fuzzySearch: FuzzySearch<Song> | null;
  drawings: Drawing[];
  dataSetName: string;
  lastDrawFailed: boolean;
  confirmMessage: string;
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

declare const umami: {
  track(
    eventName?: string,
    eventProperties?: Record<string, string | number | undefined>,
  ): void;
};

function trackDraw(count: number | null, game?: string) {
  if (typeof umami === "undefined") {
    return;
  }
  const results =
    count === null ? { result: "failed" } : { result: "success", count, game };
  umami.track("cards-drawn", results);
}

export const useDrawState = createWithEqualityFn<DrawState>(
  (set, get) => ({
    importedData: new Map(),
    gameData: null,
    fuzzySearch: null,
    drawings: [],
    dataSetName: "",
    lastDrawFailed: false,
    confirmMessage: "This will clear all songs drawn so far. Confirm?",
    clearDrawings() {
      if (get().drawings.length && !window.confirm(get().confirmMessage)) {
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
      if (state.drawings.length && !window.confirm(get().confirmMessage)) {
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
            /* webpackChunkName: "songData" */ `../songs/${dataSetName}.json`
          )
        ).default;
      applyNewData(data, set);
      return data;
    },
    drawSongs(config: ConfigState) {
      const state = get();
      if (!state.gameData) {
        trackDraw(null);
        return false;
      }

      const drawing = draw(state.gameData, config);
      trackDraw(drawing.charts.length, state.dataSetName);
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
        const newDrawings = prevState.drawings.filter(
          (d) => d.id !== drawing.id,
        );
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
  }),
  Object.is,
);

function writeDataSetToUrl(game: string) {
  const nextHash = `game-${game}`;
  if ("#" + nextHash !== window.location.hash) {
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = encodeURIComponent(nextHash);
    window.history.replaceState(undefined, "", nextUrl);
  }
}

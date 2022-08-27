import { ReactNode, useEffect } from "react";
import { UnloadHandler } from "./unload-handler";
import { draw } from "./card-draw";
import { Drawing } from "./models/Drawing";
import FuzzySearch from "fuzzy-search";
import { GameData, Song } from "./models/SongData";
import i18nData from "./assets/i18n.json";
import { detectedLanguage } from "./utils";
import { ApplyDefaultConfig } from "./apply-default-config";
import { ConfigState } from "./config-state";
import { IntlProvider } from "./intl-provider";
import * as qs from "query-string";
import createStore from "zustand";
import shallow from "zustand/shallow";

interface DrawState {
  gameData: GameData | null;
  fuzzySearch: FuzzySearch<Song> | null;
  drawings: Drawing[];
  dataSetName: string;
  lastDrawFailed: boolean;
  loadGameData(dataSetName: string): Promise<GameData>;
  /** returns false if no songs could be drawn */
  drawSongs(config: ConfigState): boolean;
}

export const useDrawState = createStore<DrawState>((set, get) => ({
  gameData: null,
  fuzzySearch: null,
  drawings: [],
  dataSetName: readDataSetFromUrl(),
  lastDrawFailed: false,
  async loadGameData(dataSetName: string) {
    set({
      gameData: null,
      dataSetName,
    });
    writeDataSetToUrl(dataSetName);

    const { default: data } = await import(
      /* webpackChunkName: "songData" */ `./songs/${dataSetName}.json`
    );
    set({
      gameData: data,
      drawings: [],
      fuzzySearch: new FuzzySearch(
        data.songs,
        [
          "name",
          "name_translation",
          "artist",
          "artist_translation",
          "search_hint",
        ],
        {
          sort: true,
        }
      ),
    });
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

    set((prevState) => ({
      drawings: [drawing, ...prevState.drawings].filter(Boolean),
      lastDrawFailed: false,
    }));
    return true;
  },
}));

interface Props {
  defaultDataSet: string;
  children: ReactNode;
}

function readDataSetFromUrl() {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("game-")) {
    return hash.slice(5);
  }
  return "";
}

function writeDataSetToUrl(game: string) {
  const next = `game-${game}`;
  if ("#" + next !== window.location.hash) {
    window.history.replaceState(
      undefined,
      "",
      qs.stringifyUrl({ url: window.location.href, fragmentIdentifier: next })
    );
  }
}

export function DrawStateManager(props: Props) {
  const [dataSetName, gameData, hasDrawings, loadGameData] = useDrawState(
    (state) => [
      state.dataSetName,
      state.gameData,
      !!state.drawings.length,
      state.loadGameData,
    ],
    shallow
  );
  useEffect(() => {
    const dataToLoad = dataSetName || props.defaultDataSet;
    loadGameData(dataToLoad);
  }, []);

  const allStrings = i18nData as Record<string, Record<string, string>>;
  const useTranslations = allStrings[detectedLanguage] || allStrings["en"];
  const additionalStrings = gameData?.i18n[detectedLanguage];
  return (
    <IntlProvider
      locale={detectedLanguage}
      translations={useTranslations}
      mergeTranslations={additionalStrings}
    >
      <ApplyDefaultConfig defaults={gameData?.defaults} />
      <UnloadHandler confirmUnload={hasDrawings} />
      {props.children}
    </IntlProvider>
  );
}

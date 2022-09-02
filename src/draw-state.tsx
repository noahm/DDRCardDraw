import { ReactNode, useEffect } from "react";
import { UnloadHandler } from "./unload-handler";
import { draw } from "./card-draw";
import { Drawing } from "./models/Drawing";
import FuzzySearch from "fuzzy-search";
import { GameData, Song } from "./models/SongData";
import i18nData from "./assets/i18n.json";
import { availableGameData, detectedLanguage } from "./utils";
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
  dataSetName: "",
  lastDrawFailed: false,
  async loadGameData(dataSetName: string) {
    const state = get();
    if (state.dataSetName === dataSetName && state.gameData) {
      return state.gameData;
    }
    if (
      state.drawings.length &&
      !confirm("This will clear all songs drawn so far. Confirm?")
    ) {
      return state.gameData;
    }
    set({
      gameData: null,
      dataSetName,
      drawings: [],
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
  const [gameData, hasDrawings, loadGameData] = useDrawState(
    (state) => [state.gameData, !!state.drawings.length, state.loadGameData],
    shallow
  );
  useEffect(() => {
    loadGameData(getInitialDataSet(props.defaultDataSet));
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

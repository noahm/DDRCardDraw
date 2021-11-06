import { createContext, Component } from "react";
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

interface DrawState {
  gameData: GameData | null;
  fuzzySearch: FuzzySearch<Song> | null;
  drawings: Drawing[];
  dataSetName: string;
  lastDrawFailed: boolean;
  loadGameData: (dataSetName: string) => Promise<GameData>;
  drawSongs: (config: ConfigState) => void;
}

export const DrawStateContext = createContext<DrawState>({
  gameData: null,
  fuzzySearch: null,
  drawings: [],
  dataSetName: "",
  lastDrawFailed: false,
  loadGameData() {
    return Promise.reject();
  },
  drawSongs() {},
});

interface Props {
  defaultDataSet: string;
}

function setGameInUrl(game: string) {
  const next = qs.stringifyUrl({
    url: location.href,
    query: {
      game,
    },
  });
  if (next !== location.href) {
    window.history.replaceState(undefined, "", next);
  }
}

export class DrawStateManager extends Component<Props, DrawState> {
  constructor(props: Props) {
    super(props);

    const query = qs.parse(location.search);
    this.state = {
      gameData: null,
      fuzzySearch: null,
      drawings: [],
      dataSetName: (query.game as string) || props.defaultDataSet,
      lastDrawFailed: false,
      loadGameData: this.loadSongSet,
      drawSongs: this.doDrawing,
    };
  }

  componentDidMount() {
    this.loadSongSet(this.state.dataSetName);
  }

  render() {
    const allStrings = i18nData as Record<string, Record<string, string>>;
    const useTranslations = allStrings[detectedLanguage] || allStrings["en"];
    const additionalStrings = this.state.gameData?.i18n[detectedLanguage];
    return (
      <DrawStateContext.Provider value={this.state}>
        <IntlProvider
          locale={detectedLanguage}
          translations={useTranslations}
          mergeTranslations={additionalStrings}
        >
          <ApplyDefaultConfig defaults={this.state.gameData?.defaults} />
          <UnloadHandler confirmUnload={!!this.state.drawings.length} />
          {this.props.children}
        </IntlProvider>
      </DrawStateContext.Provider>
    );
  }

  loadSongSet = (dataSetName: string) => {
    if (
      this.state.drawings.length &&
      !confirm("This will clear all drawn songs so far. Confirm?")
    ) {
      return Promise.resolve(this.state.gameData);
    }

    this.setState({
      gameData: null,
      dataSetName,
      drawings: [],
    });
    setGameInUrl(dataSetName);

    return import(
      /* webpackChunkName: "songData" */ `./songs/${dataSetName}.json`
    ).then(({ default: data }) => {
      this.setState({
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
    });
  };

  doDrawing = (config: ConfigState) => {
    if (!this.state.gameData) {
      return;
    }

    const drawing = draw(this.state.gameData, config);
    if (!drawing.charts.length) {
      this.setState({
        lastDrawFailed: true,
      });
      return;
    }

    this.setState((prevState) => ({
      drawings: [drawing, ...prevState.drawings].filter(Boolean),
      lastDrawFailed: false,
    }));
  };
}

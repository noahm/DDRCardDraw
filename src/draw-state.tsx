import { createContext, Component } from "preact";
import { UnloadHandler } from "./unload-handler";
import { draw } from "./card-draw";
import { Drawing } from "./models/Drawing";
import FuzzySearch from "fuzzy-search";
import { GameData, Song } from "./models/SongData";
import { TranslateProvider } from "@denysvuika/preact-translate";
import { LanguageData } from "@denysvuika/preact-translate/src/languageData";
import i18nData from "./assets/i18n.json";
import { detectedLanguage } from "./utils";
import { ApplyDefaultConfig } from "./apply-default-config";
import { ConfigState } from "./config-state";

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
  drawSongs() {}
});

interface Props {
  defaultDataSet: string;
}

export class DrawStateManager extends Component<Props, DrawState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      gameData: null,
      fuzzySearch: null,
      drawings: [],
      dataSetName: props.defaultDataSet,
      lastDrawFailed: false,
      loadGameData: this.loadSongSet,
      drawSongs: this.doDrawing
    };
  }

  componentDidMount() {
    this.loadSongSet(this.state.dataSetName);
  }

  render() {
    const translations: LanguageData = {};
    for (const lang in i18nData as LanguageData) {
      // @ts-ignore
      translations[lang] = i18nData[lang];
      if (this.state.gameData) {
        translations[lang].meta = this.state.gameData.i18n[lang];
      }
    }
    return (
      <DrawStateContext.Provider value={this.state}>
        <TranslateProvider translations={translations} lang={detectedLanguage}>
          <ApplyDefaultConfig defaults={this.state.gameData?.defaults} />
          <UnloadHandler confirmUnload={!!this.state.drawings.length} />
          {this.props.children}
        </TranslateProvider>
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
      dataSetName
    });

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
            "search_hint"
          ],
          {
            sort: true
          }
        )
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
        lastDrawFailed: true
      });
      return;
    }

    this.setState(prevState => ({
      drawings: [drawing, ...prevState.drawings].filter(Boolean),
      lastDrawFailed: false
    }));
  };
}

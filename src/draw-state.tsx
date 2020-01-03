import { createContext, Component } from "preact";
import { UnloadHandler } from "./unload-handler";
import { draw } from "./card-draw";
import { Drawing } from "./models/Drawing";
import FuzzySearch from "fuzzy-search";
import { SongList, Song } from "./models/SongData";

interface DrawState {
  songs: SongList | null;
  fuzzySearch: FuzzySearch<Song> | null;
  drawings: Drawing[];
  dataSetName: string;
  lastDrawFailed: boolean;
  loadSongSet: (dataSetName: string) => void;
  drawSongs: (config: FormData) => void;
}

export const DrawStateContext = createContext<DrawState>({
  songs: null,
  fuzzySearch: null,
  drawings: [],
  dataSetName: "",
  lastDrawFailed: false,
  loadSongSet() {},
  drawSongs() {}
});

interface Props {
  defaultDataSet: string;
}

export class DrawStateManager extends Component<Props, DrawState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      songs: null,
      fuzzySearch: null,
      drawings: [],
      dataSetName: props.defaultDataSet,
      lastDrawFailed: false,
      loadSongSet: this.loadSongSet,
      drawSongs: this.doDrawing
    };
  }

  componentDidMount() {
    this.loadSongSet(this.state.dataSetName);
  }

  render() {
    return (
      <DrawStateContext.Provider value={this.state}>
        <UnloadHandler confirmUnload={!!this.state.drawings.length} />
        {this.props.children}
      </DrawStateContext.Provider>
    );
  }

  loadSongSet = (dataSetName: string) => {
    this.setState({
      songs: null,
      dataSetName
    });

    import(
      /* webpackChunkName: "songData" */ `./songs/${dataSetName}.json`
    ).then(({ default: data }) => {
      this.setState({
        songs: data,
        fuzzySearch: new FuzzySearch(
          data,
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
    });
  };

  doDrawing = (configData: FormData) => {
    if (!this.state.songs) {
      return;
    }

    const drawing = draw(this.state.songs, configData);
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

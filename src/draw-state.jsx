import { createContext, Component } from "preact";
import { UnloadHandler } from "./unload-handler";
import { draw } from "./card-draw";
import FuzzySearch from "fuzzy-search";

export const DrawStateContext = createContext();

export class DrawStateManager extends Component {
  constructor(props) {
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

  loadSongSet = dataSetName => {
    this.setState({
      songs: null,
      dataSetName
    });

    import(
      /* webpackChunkName: "songData" */ `./songs/${dataSetName}.json`
    ).then(data => {
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

  doDrawing = configData => {
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
      drawings: [drawing].concat(prevState.drawings).filter(Boolean),
      lastDrawFailed: false
    }));
  };
}

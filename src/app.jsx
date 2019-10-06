import * as OfflinePluginRuntime from "offline-plugin/runtime";
import { Component, render } from "preact";
import { Controls } from "./controls";
import { DrawingList } from "./drawing-list";
import { Footer } from "./footer";
import { draw } from "./card-draw";
import styles from "./app.css";
import { TOURNAMENT_MODE } from "./utils";
import { IntlProvider } from "preact-i18n";
import i18n from "./assets/i18n.json";

let songs;
let songDataLoading = null;
function loadSongData(dataName) {
  songDataLoading = import(
    /* webpackChunkName: "songData" */ `./songs/${dataName}.json`
  ).then(data => {
    songs = data;
    songDataLoading = null;
  });
}

class App extends Component {
  state = {
    drawings: [],
    lastDrawFailed: false,
    hasUpdate: false,
    languageSet: null
  };

  componentWillMount() {
    const language =
      (window.navigator.languages && window.navigator.languages[0]) ||
      window.navigator.language ||
      window.navigator.userLanguage ||
      window.navigator.browserLanguage;
    this.state.languageSet = i18n[language] ? i18n[language] : i18n["en"];
  }

  componentDidMount() {
    OfflinePluginRuntime.install({
      onUpdateReady() {
        OfflinePluginRuntime.applyUpdate();
      },
      onUpdated: () => {
        this.setState({
          hasUpdate: true
        });
      }
    });
    window.addEventListener("beforeunload", this.handleUnload);
    loadSongData("ace");
  }

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.handleUnload);
  }

  render() {
    return (
      <IntlProvider definition={this.state.languageSet}>
        <div className={styles.container}>
          {this.state.hasUpdate && (
            <p className={styles.updateBanner}>
              Update available, refresh for the freshest code around!
            </p>
          )}
          <Controls
            onDraw={this.doDrawing}
            onSongListChange={loadSongData}
            canPromote={
              TOURNAMENT_MODE &&
              this.state.drawings.length > 1 &&
              !!this.state.drawings[0]
            }
            onPromote={this.handlePromote}
            lastDrawFailed={this.state.lastDrawFailed}
          />
          <DrawingList drawings={this.state.drawings} />
          <Footer />
        </div>
      </IntlProvider>
    );
  }

  doDrawing = configData => {
    // wait for async load of song data, if necessary
    if (songDataLoading) {
      songDataLoading.then(() => doDrawing(configData));
      return;
    }

    const drawing = draw(songs, configData);
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

  handlePromote = () => {
    if (!this.state.drawings.length || !this.state.drawings[0]) {
      return;
    }

    this.setState(prevState => ({
      drawings: [null].concat(prevState.drawings),
      lastDrawFailed: false
    }));
  };

  handleUnload = e => {
    if (this.state.drawings.length) {
      e.returnValue = "Are you sure you want to leave?";
    }
  };
}

render(<App />, document.body);

import "./firebase";
import { Component, render } from "preact";
import { IntlProvider, withText } from "preact-i18n";
import { Controls } from "./controls";
import { DrawingList } from "./drawing-list";
import { Footer } from "./footer";
import { draw } from "./card-draw";
import styles from "./app.css";
import i18n from "./assets/i18n.json";
import { AuthProvider } from "./auth";
import { TOURNAMENT_MODE, detectedLanguage } from "./utils";
import { UpdateManager } from "./update-manager";

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
    lastDrawFailed: false
  };

  componentDidMount() {
    window.addEventListener("beforeunload", this.handleUnload);
    loadSongData("a20");
  }

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.handleUnload);
  }

  render() {
    return (
      <div className={styles.container}>
        <UpdateManager />
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
      e.returnValue = this.props.confirmText;
    }
  };
}

const AppWithText = withText({ confirmText: "confirmClose" })(App);

const languageSet = i18n[detectedLanguage] || i18n["en"];
render(
  <IntlProvider definition={languageSet}>
    <AuthProvider>
      <AppWithText />
    </AuthProvider>
  </IntlProvider>,
  document.body
);

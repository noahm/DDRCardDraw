import "./firebase";
import { render } from "preact";
import { IntlProvider } from "preact-i18n";
import { Controls } from "./controls";
import { DrawingList } from "./drawing-list";
import { Footer } from "./footer";
import i18n from "./assets/i18n.json";
import { AuthManager } from "./auth";
import { detectedLanguage } from "./utils";
import { UpdateManager } from "./update-manager";
import { DrawStateManager } from "./draw-state";
import { SongSearch } from "./song-search";
import { SuspectSongs } from "./SuspectSongs";
import styles from "./app.css";

const languageSet = i18n[detectedLanguage] || i18n["en"];

function App() {
  return (
    <IntlProvider definition={languageSet}>
      <AuthManager>
        <DrawStateManager defaultDataSet="a20">
          <UpdateManager />
          <Controls />
          {/* <SongSearch /> */}
          <DrawingList />
          {/* <SuspectSongs /> */}
          <Footer />
        </DrawStateManager>
      </AuthManager>
    </IntlProvider>
  );
}

const appRoot = document.createElement("main");
document.body.prepend(appRoot);
appRoot.className = styles.container;
render(<App />, appRoot);

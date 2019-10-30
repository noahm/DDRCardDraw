import "./firebase";
import { render } from "preact";
import { IntlProvider } from "preact-i18n";
import { Controls } from "./controls";
import { DrawingList } from "./drawing-list";
import { Footer } from "./footer";
import styles from "./app.css";
import i18n from "./assets/i18n.json";
import { AuthProvider } from "./auth";
import { detectedLanguage } from "./utils";
import { UpdateManager } from "./update-manager";
import { DrawStateProvider } from "./draw-state";

const languageSet = i18n[detectedLanguage] || i18n["en"];

function App() {
  return (
    <IntlProvider definition={languageSet}>
      <AuthProvider>
        <DrawStateProvider defaultDataSet="a20">
          <div className={styles.container}>
            <UpdateManager />
            <Controls />
            <DrawingList />
            <Footer />
          </div>
        </DrawStateProvider>
      </AuthProvider>
    </IntlProvider>
  );
}

render(<App />, document.body);

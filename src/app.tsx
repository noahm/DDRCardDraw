if (process.env.NODE_ENV === "development") {
  // Must use require here as import statements are only allowed
  // to exist at the top of a file.
  require("preact/debug");
}

import "./firebase";
import { render } from "preact";
import { Controls } from "./controls";
import { DrawingList } from "./drawing-list";
import { Footer } from "./footer";
import { AuthManager } from "./auth";
import { UpdateManager } from "./update-manager";
import { DrawStateManager } from "./draw-state";
import { SongSearch } from "./song-search";
import { SuspectSongs } from "./SuspectSongs";
import styles from "./app.css";
import { ConfigStateManager } from "./config-state";

function App() {
  return (
    <AuthManager>
      <ConfigStateManager>
        <DrawStateManager defaultDataSet="a20plus">
          <UpdateManager />
          <Controls />
          {/* <SuspectSongs /> */}
          <DrawingList />
          <Footer />
        </DrawStateManager>
      </ConfigStateManager>
    </AuthManager>
  );
}

const appRoot = document.createElement("main");
document.body.prepend(appRoot);
appRoot.className = styles.container;
render(<App />, appRoot);

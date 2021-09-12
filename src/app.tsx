import { render } from "preact";
import { Controls } from "./controls";
import { DrawingList } from "./drawing-list";
import { Footer } from "./footer";
import { UpdateManager } from "./update-manager";
import { DrawStateManager } from "./draw-state";
import { SongSearch } from "./song-search";
import { SuspectSongs } from "./SuspectSongs";
import styles from "./app.css";
import { ConfigStateManager } from "./config-state";

function App() {
  return (
    <ConfigStateManager>
      <DrawStateManager defaultDataSet="a20plus">
        <UpdateManager />
        <Controls />
        {/* <SuspectSongs /> */}
        <DrawingList />
        <Footer />
      </DrawStateManager>
    </ConfigStateManager>
  );
}

const appRoot = document.createElement("main");
document.body.prepend(appRoot);
appRoot.className = styles.container;
render(<App />, appRoot);

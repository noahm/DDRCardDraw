if (process.env.NODE_ENV === "development") {
  // Must use require here as import statements are only allowed
  // to exist at the top of a file.
  require("preact/debug");
}

import "./firebase";
import { render } from "preact";
import { useEffect } from "preact/hooks";
import { Route, Switch, useLocation } from "wouter-preact";
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

interface RedirectProps {
  replace?: boolean;
  to: string;
}

function Redirect({ to, replace }: RedirectProps) {
  const [_, setLocation] = useLocation();
  useEffect(() => setLocation(to, replace), [to, replace]);
  return null;
}

function App() {
  return (
    <AuthManager>
      <ConfigStateManager>
        <Switch>
          <Route path="/:dataSet">
            {params => (
              <DrawStateManager dataSet={params.dataSet}>
                <UpdateManager />
                <Controls />
                {/* <SuspectSongs /> */}
                <DrawingList />
                <Footer />
              </DrawStateManager>
            )}
          </Route>
          <Route path="/">
            <Redirect to="/a20" replace />
          </Route>
        </Switch>
      </ConfigStateManager>
    </AuthManager>
  );
}

const appRoot = document.createElement("main");
document.body.prepend(appRoot);
appRoot.className = styles.container;
render(<App />, appRoot);

import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/table/lib/css/table.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "@blueprintjs/select/lib/css/blueprint-select.css";
import "@blueprintjs/datetime2/lib/css/blueprint-datetime2.css";

import { FocusStyleManager } from "@blueprintjs/core";

FocusStyleManager.onlyShowFocusOnTabs();

import { UpdateManager } from "./update-manager";
import { IntlProvider } from "./intl-provider";
import { ThemeSyncWidget } from "./theme-toggle";
import { Provider } from "react-redux";
import { store } from "./state/store";
import { PartySocketManager } from "./party/client";

import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useParams,
  Link,
} from "react-router-dom";
import { nanoid } from "nanoid";
import { ClassicModeShell } from "./classic-mode";

const router = createBrowserRouter([
  {
    path: "/",
    Component: () => {
      return (
        <div style={{ padding: "1em" }}>
          <h1>DDR Tools Event Mode</h1>
          <h2 style={{ fontStyle: "italic" }}>Alpha Preview</h2>
          <p>
            You need to pick an event first. Would you like to:{" "}
            <Link to={`/e/${nanoid()}`}>Create New Event?</Link>
          </p>
          <p>
            Or... perhaps just use the app in{" "}
            <Link to="/classic">Classic Mode</Link>
          </p>
          <p>
            No idea what this is?{" "}
            <a href="https://youtu.be/4Gpj9jTNcfM">Here's a video</a> trying to
            explain how to use it!
          </p>
        </div>
      );
    },
  },
  {
    path: "classic",
    Component: ClassicModeShell,
    children: [
      {
        index: true,
        lazy: async () => {
          const mod = await import("./drawing-list");
          return { Component: mod.DrawingList };
        },
      },
      {
        path: "charts",
        lazy: async () => {
          const mod = await import("./eligible-charts");
          return { Component: mod.default };
        },
      },
    ],
  },
  {
    path: "e/:roomName",
    lazy: async () => ({
      Component: (await import("./tournament-mode")).TournamentModeApp,
    }),
  },
  {
    path: "e/:roomName/cab/:cabId/source",
    element: <ObsSource />,
    children: [
      {
        path: "cards",
        lazy: async () => {
          const { CabCards } = await import("./obs-sources/cards");
          return { Component: CabCards };
        },
      },
      {
        path: "title",
        lazy: async () => {
          const { CabTitle } = await import("./obs-sources/text");
          return { Component: CabTitle };
        },
      },
      {
        path: "players",
        lazy: async () => {
          const { CabPlayers } = await import("./obs-sources/text");
          return { Component: CabPlayers };
        },
      },
      {
        path: "p1",
        lazy: async () => {
          const { CabPlayer } = await import("./obs-sources/text");
          return { element: <CabPlayer p={1} /> };
        },
      },
      {
        path: "p2",
        lazy: async () => {
          const { CabPlayer } = await import("./obs-sources/text");
          return { element: <CabPlayer p={2} /> };
        },
      },
    ],
  },
]);

function ObsSource() {
  const params = useParams<"roomName" | "cabId">();
  if (!params.roomName) {
    return null;
  }
  return (
    <Provider store={store}>
      <PartySocketManager roomName={params.roomName}>
        <IntlProvider>
          <Outlet />
        </IntlProvider>
      </PartySocketManager>
    </Provider>
  );
}

export function App() {
  return (
    <IntlProvider>
      <ThemeSyncWidget />
      <UpdateManager />
      <RouterProvider router={router} />
    </IntlProvider>
  );
}

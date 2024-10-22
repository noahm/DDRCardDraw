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
import { Header } from "./header";
import { ThemeSyncWidget } from "./theme-toggle";
import { Provider } from "react-redux";
import { store } from "./state/store";
import { PartySocketManager } from "./party/client";
import { Provider as UrqlProvider } from "urql";

import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useParams,
  Link,
} from "react-router-dom";
import { CabManagement } from "./cab-management";
import { MainView } from "./main-view";
import { nanoid } from "nanoid";
import { urqlClient } from "./startgg-gql";

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
        </div>
      );
    },
  },
  {
    path: "static-cards",
    lazy: async () => {
      const { StaticCards } = await import("./obs-sources/static-cards");
      return {
        element: (
          <Provider store={store}>
            <StaticCards />
          </Provider>
        ),
      };
    },
  },
  {
    path: "e/:roomName",
    element: <AppForRoom />,
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

function AppForRoom() {
  const params = useParams<"roomName">();
  if (!params.roomName) {
    return null;
  }
  return (
    <Provider store={store}>
      <PartySocketManager roomName={params.roomName}>
        <UrqlProvider value={urqlClient}>
          <IntlProvider>
            <UpdateManager />
            <Header />
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "stretch",
                flex: "1 1 0px",
                overflow: "hidden",
              }}
            >
              <CabManagement />
              <MainView />
            </div>
          </IntlProvider>
        </UrqlProvider>
      </PartySocketManager>
    </Provider>
  );
}

export function App() {
  return (
    <>
      <ThemeSyncWidget />
      <RouterProvider router={router} />
    </>
  );
}

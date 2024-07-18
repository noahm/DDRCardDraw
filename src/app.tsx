import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "@blueprintjs/select/lib/css/blueprint-select.css";
import "@blueprintjs/datetime2/lib/css/blueprint-datetime2.css";

import { FocusStyleManager } from "@blueprintjs/core";

FocusStyleManager.onlyShowFocusOnTabs();

import { UpdateManager } from "./update-manager";
import { IntlProvider } from "./intl-provider";
import { Header } from "./header";
import { ThemeSyncWidget } from "./theme-toggle";
import { DropHandler } from "./drop-handler";
import { Provider } from "react-redux";
import { store } from "./state/store";
import { PartySocketManager } from "./party/client";

import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useParams,
} from "react-router-dom";
import { CabManagement } from "./cab-management";
import { MainView } from "./main-view";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <>
        <p>
          You need to pick an event first. How about this one:{" "}
          <a href="/e/default">Default Event</a>
        </p>
      </>
    ),
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
          <DropHandler />
        </IntlProvider>
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

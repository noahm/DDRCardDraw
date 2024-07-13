import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "@blueprintjs/select/lib/css/blueprint-select.css";
import "@blueprintjs/datetime2/lib/css/blueprint-datetime2.css";

import { FocusStyleManager } from "@blueprintjs/core";

FocusStyleManager.onlyShowFocusOnTabs();

import { DrawingList } from "./drawing-list";
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
  RouterProvider,
  useParams,
} from "react-router-dom";
import { CabManagement } from "./cab-management";

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
]);

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
            <DrawingList />
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

import { Provider as ReduxProvider } from "react-redux";
import { Header } from "../header";
import { createClientStore } from "../state/store";
import { Outlet } from "react-router-dom";
import { ClassicModeContext } from "../common-components/app-mode";
import { LocalStorageManager } from "./localstorage-manager";
import { useMemo } from "react";
import { classicModeState } from "../state/localstorage";

export function ClassicModeShell() {
  const store = useMemo(() => createClientStore(classicModeState), []);
  return (
    <ReduxProvider store={store}>
      <LocalStorageManager />
      <ClassicModeContext>
        <Header />
        <Outlet />
      </ClassicModeContext>
    </ReduxProvider>
  );
}

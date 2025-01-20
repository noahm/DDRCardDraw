import { Provider as ReduxProvider } from "react-redux";
import { Header } from "../header";
import { store } from "../state/store";
import { Outlet } from "react-router-dom";
import { ClassicModeContext } from "../common-components/app-mode";
import { LocalStorageManager } from "./localstorage-manager";

export function ClassicModeShell() {
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

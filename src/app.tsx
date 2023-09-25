import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "@blueprintjs/select/lib/css/blueprint-select.css";

import { FocusStyleManager } from "@blueprintjs/core";

FocusStyleManager.onlyShowFocusOnTabs();

import { DrawingList } from "./drawing-list";
import { UpdateManager } from "./update-manager";
import { DrawStateManager } from "./draw-state";
import { Header } from "./header";
import { ThemeSyncWidget } from "./theme-toggle";

export function App() {
  return (
    <DrawStateManager defaultDataSet="a3">
      <ThemeSyncWidget />
      <UpdateManager />
      <Header />
      <DrawingList />
    </DrawStateManager>
  );
}

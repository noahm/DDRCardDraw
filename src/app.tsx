import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "@blueprintjs/popover2/lib/css/blueprint-popover2.css";

import { FocusStyleManager } from "@blueprintjs/core";

FocusStyleManager.onlyShowFocusOnTabs();

import { DrawingList } from "./drawing-list";
import { UpdateManager } from "./update-manager";
import { DrawStateManager } from "./draw-state";
import { ConfigStateManager } from "./config-state";
import { Header } from "./header";

export function App() {
  return (
    <ConfigStateManager>
      <DrawStateManager defaultDataSet="a20plus">
        <UpdateManager />
        <Header />
        <DrawingList />
      </DrawStateManager>
    </ConfigStateManager>
  );
}

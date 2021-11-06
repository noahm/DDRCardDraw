import { Controls } from "./controls";
import { DrawingList } from "./drawing-list";
import { Footer } from "./footer";
import { UpdateManager } from "./update-manager";
import { DrawStateManager } from "./draw-state";
import { ConfigStateManager } from "./config-state";

export function App() {
  return (
    <ConfigStateManager>
      <DrawStateManager defaultDataSet="a20plus">
        <UpdateManager />
        <Controls />
        <DrawingList />
        <Footer />
      </DrawStateManager>
    </ConfigStateManager>
  );
}

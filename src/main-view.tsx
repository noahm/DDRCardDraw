import { Tabs, Tab } from "@blueprintjs/core";
import { PlayerNamesControls } from "./controls/player-names";
import { DrawingList } from "./drawing-list";
import { atom, useAtom } from "jotai";
import styles from "./main-view.css";

export type MainTabId = "drawings" | "players" | "sets";
export const mainTabAtom = atom<MainTabId>("drawings");

export function MainView() {
  const [currentTab, setCurrentTab] = useAtom(mainTabAtom);
  return (
    <Tabs
      id="main-view"
      className={styles.mainView}
      large
      selectedTabId={currentTab}
      onChange={(newTabId: MainTabId) => setCurrentTab(newTabId)}
    >
      <Tab id="drawings" panel={<DrawingList />}>
        Drawings
      </Tab>
      <Tab id="players" panel={<PlayerNamesControls />}>
        Start.gg Sync
      </Tab>
    </Tabs>
  );
}

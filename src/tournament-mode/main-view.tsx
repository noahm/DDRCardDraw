import { Tabs } from "@mantine/core";
import { PlayerNamesControls } from "../controls/player-names";
import { DrawingList } from "../drawing-list";
import { atom, useAtom } from "jotai";
import styles from "./main-view.css";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../utils/error-fallback";
import { DelayedSpinner } from "../common-components/delayed-spinner";

export type MainTabId = "drawings" | "players" | "sets";
export const mainTabAtom = atom<MainTabId>("drawings");

const EligibleChartsList = lazy(() => import("../eligible-charts"));

export function MainView() {
  const [currentTab, setCurrentTab] = useAtom(mainTabAtom);
  return (
    <Tabs
      className={styles.mainView}
      value={currentTab}
      onChange={(newTabId) => setCurrentTab(newTabId as MainTabId)}
      keepMounted={false}
    >
      <Tabs.List>
        <Tabs.Tab value="drawings">Drawings</Tabs.Tab>
        <Tabs.Tab value="eligible">Eligible Charts</Tabs.Tab>
        <Tabs.Tab value="players">Start.gg Sync</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="drawings">
        <DrawingList />
      </Tabs.Panel>
      <Tabs.Panel value="eligible">
        <ErrorBoundary fallback={<ErrorFallback />}>
          <Suspense fallback={<DelayedSpinner />}>
            <EligibleChartsList />
          </Suspense>
        </ErrorBoundary>
      </Tabs.Panel>
      <Tabs.Panel value="players">
        <PlayerNamesControls />
      </Tabs.Panel>
    </Tabs>
  );
}

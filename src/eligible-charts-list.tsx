import { eligibleCharts } from "./card-draw";
import { useConfigState } from "./config-state";
import { useDrawState } from "./draw-state";
import { SongCard } from "./song-card";
import styles from "./drawing-list.css";
import { DrawnChart } from "./models/Drawing";
import {
  HTMLSelect,
  Navbar,
  NavbarGroup,
  NavbarDivider,
  Spinner,
} from "@blueprintjs/core";
import { useIntl } from "./hooks/useIntl";
import { useIsNarrow } from "./hooks/useMediaQuery";
import { atom, useAtom } from "jotai";
import { useDeferredValue, useMemo } from "react";

function songKeyFromChart(chart: DrawnChart) {
  return `${chart.name}:${chart.artist}`;
}

const currentTabAtom = atom("all");

export function EligibleChartsListFilter() {
  const { t } = useIntl();
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const selectedFlags = Array.from(useConfigState((cfg) => cfg.flags));

  if (!selectedFlags.length) {
    return null;
  }

  selectedFlags.unshift("all");

  return (
    <HTMLSelect
      value={currentTab}
      onChange={(e) => setCurrentTab(e.currentTarget.value)}
      options={Array.from(selectedFlags).map((flag) => ({
        value: flag,
        label: flag === "all" ? "All charts" : t(`meta.${flag}`),
      }))}
    />
  );
}

export function EligibleChartsList() {
  const gameData = useDrawState((s) => s.gameData);
  const [currentTab] = useDeferredValue(useAtom(currentTabAtom));
  const configState = useDeferredValue(useConfigState());
  const isNarrow = useIsNarrow();
  const isDisplayFiltered = currentTab !== "all";

  if (!gameData) {
    return <Spinner />;
  }
  const charts = Array.from(eligibleCharts(configState, gameData.songs));
  const songs = new Set<string>();
  const cards = useMemo(
    () =>
      charts
        .map((chart, index) => {
          songs.add(songKeyFromChart(chart));
          if (isDisplayFiltered && chart.flags.every((f) => f !== currentTab)) {
            return null;
          }
          return <SongCard chart={chart} key={index} />;
        })
        .filter(Boolean),
    [currentTab, charts]
  );

  return (
    <>
      <Navbar
        style={{
          position: "sticky",
          top: "50px",
        }}
      >
        <NavbarGroup>
          {charts.length} eligible charts from {songs.size} songs (of{" "}
          {gameData.songs.length} total)
        </NavbarGroup>
        {configState.flags.size > 0 && !isNarrow && (
          <NavbarGroup>
            <NavbarDivider />
            <EligibleChartsListFilter />
          </NavbarGroup>
        )}
      </Navbar>
      <div className={styles.chartList}>{cards}</div>
    </>
  );
}

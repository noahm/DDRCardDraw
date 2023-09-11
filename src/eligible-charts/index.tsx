import { eligibleCharts } from "../card-draw";
import { useConfigState } from "../config-state";
import { useDrawState } from "../draw-state";
import { SongCard } from "../song-card";
import styles from "../drawing-list.css";
import { EligibleChart } from "../models/Drawing";
import { Navbar, NavbarGroup, NavbarDivider, Spinner } from "@blueprintjs/core";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { useAtom } from "jotai";
import { useDeferredValue, useMemo } from "react";
import { currentTabAtom, EligibleChartsListFilter } from "./filter";
import { DiffHistogram } from "./histogram";
import { isDegrs, TesterCard } from "../controls/degrs-tester";

function songKeyFromChart(chart: EligibleChart) {
  return `${chart.name}:${chart.artist}`;
}

export default function EligibleChartsList() {
  const gameData = useDrawState((s) => s.gameData);
  const [currentTab] = useDeferredValue(useAtom(currentTabAtom));
  const configState = useDeferredValue(useConfigState());
  const isNarrow = useIsNarrow();
  const isDisplayFiltered = currentTab !== "all";

  const charts = useMemo(
    () => (gameData ? Array.from(eligibleCharts(configState, gameData)) : []),
    [gameData, configState],
  );
  const [songs, filteredCharts] = useMemo(() => {
    const songs = new Set<string>();
    const filtered = charts.filter((chart) => {
      songs.add(songKeyFromChart(chart));
      if (isDisplayFiltered && chart.flags.every((f) => f !== currentTab)) {
        return false;
      }
      return true;
    });
    return [songs, filtered];
  }, [charts, isDisplayFiltered, currentTab]);

  if (!gameData) {
    return <Spinner />;
  }

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
      <DiffHistogram charts={filteredCharts} />
      <div className={styles.chartList}>
        {filteredCharts.map((chart, idx) =>
          isDegrs(chart) ? (
            <TesterCard chart={chart} key={idx} />
          ) : (
            <SongCard chart={chart} key={idx} />
          ),
        )}
      </div>
    </>
  );
}

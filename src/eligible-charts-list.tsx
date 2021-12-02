import { useContext } from "react";
import { eligibleCharts } from "./card-draw";
import { ConfigStateContext } from "./config-state";
import { DrawStateContext } from "./draw-state";
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
import { Tooltip2 } from "@blueprintjs/popover2";

function songKeyFromChart(chart: DrawnChart) {
  return `${chart.name}:${chart.artist}`;
}

const currentTabAtom = atom("all");

export function EligibleChartsListFilter() {
  const { t } = useIntl();
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const configState = useContext(ConfigStateContext);
  const selectedFlags = Array.from(configState.flags);

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
  const [currentTab] = useAtom(currentTabAtom);
  const { gameData } = useContext(DrawStateContext);
  const configState = useContext(ConfigStateContext);
  const isNarrow = useIsNarrow();
  const isDisplayFiltered = currentTab !== "all";

  if (!gameData) {
    return <Spinner />;
  }
  let charts = Array.from(eligibleCharts(configState, gameData.songs));
  const songs = new Set<string>();
  const cards = charts
    .map((chart, index) => {
      songs.add(songKeyFromChart(chart));
      if (isDisplayFiltered && chart.flags.every((f) => f !== currentTab)) {
        return null;
      }
      return <SongCard chart={chart} key={index} />;
    })
    .filter(Boolean);

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

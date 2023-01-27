import { eligibleCharts } from "./card-draw";
import { useConfigState } from "./config-state";
import { useDrawState } from "./draw-state";
import { SongCard } from "./song-card";
import styles from "./drawing-list.module.css";
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
import { DiffHistogram } from "./histogram";

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
  const [currentTab] = useAtom(currentTabAtom);
  const gameData = useDrawState((s) => s.gameData);
  const configState = useConfigState();
  const isNarrow = useIsNarrow();
  const isDisplayFiltered = currentTab !== "all";

  if (!gameData) {
    return <Spinner />;
  }
  let charts = Array.from(eligibleCharts(configState, gameData.songs));
  const songs = new Set<string>();
  const filteredCharts = charts.filter((chart) => {
    songs.add(songKeyFromChart(chart));
    if (isDisplayFiltered && chart.flags.every((f) => f !== currentTab)) {
      return false;
    }
    return true;
  });

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
        {filteredCharts.map((chart, idx) => (
          <SongCard chart={chart} key={idx} />
        ))}
      </div>
    </>
  );
}

import { eligibleCharts } from "../card-draw";
import {
  ConfigContextProvider,
  useConfigState,
  useGameData,
} from "../state/hooks";
import { SongCard } from "../song-card";
import styles from "../drawing-list.css";
import { EligibleChart } from "../models/Drawing";
import {
  Navbar,
  NavbarGroup,
  NavbarDivider,
  Spinner,
  Button,
} from "@blueprintjs/core";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { useAtom } from "jotai";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { currentTabAtom, EligibleChartsListFilter } from "./filter";
import { DiffHistogram } from "./histogram";
import { isDegrs, TesterCard } from "../controls/degrs-tester";
import { Export } from "@blueprintjs/icons";
import { shareCharts } from "../utils/share";
import { ConfigSelect } from "../controls";

function songKeyFromChart(chart: EligibleChart) {
  return `${chart.name}:${chart.artist}`;
}

export default function EligibleChartsView() {
  const [configId, setConfigId] = useState<string | null>(null);
  const selector = (
    <ConfigSelect onChange={setConfigId} selectedId={configId} />
  );

  if (!configId) {
    return selector;
  }

  return (
    <>
      {selector}
      <ConfigContextProvider value={configId}>
        <EligibleChartsList />
      </ConfigContextProvider>
    </>
  );
}

function EligibleChartsList() {
  const gameData = useGameData();
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

  const exportData = useCallback(async () => {
    shareCharts(filteredCharts, "eligible");
  }, [filteredCharts]);

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
        {configState.flags.length > 0 && !isNarrow && (
          <NavbarGroup>
            <NavbarDivider />
            <EligibleChartsListFilter />
          </NavbarGroup>
        )}
        <NavbarGroup align="right">
          <Button
            aria-label={isNarrow ? "Export Chart Data" : undefined}
            title="Export current chart data as a CSV file"
            icon={<Export />}
            onClick={exportData}
          >
            {isNarrow ? "" : "Export Chart Data"}
          </Button>
        </NavbarGroup>
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

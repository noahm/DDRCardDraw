import { eligibleCharts } from "../card-draw";
import {
  ConfigContextProvider,
  useConfigState,
  useGameData,
} from "../state/hooks";
import { SongCard } from "../song-card";
import styles from "../drawing-list.css";
import { EligibleChart } from "../models/Drawing";
import { Button, Divider, Loader } from "@mantine/core";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { useAtom } from "jotai";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { currentTabAtom, EligibleChartsListFilter } from "./filter";
import { DiffHistogram } from "./histogram";
import { isDegrs, TesterCard } from "../controls/degrs-tester";
import { IconFileExport } from "@tabler/icons-react";
import { shareCharts } from "../utils/share";
import { ConfigSelect } from "../controls";
import { HeaderBar } from "../common-components/header-bar";

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
    await shareCharts(filteredCharts, "eligible");
  }, [filteredCharts]);

  if (!gameData) {
    return <Loader />;
  }

  return (
    <>
      <HeaderBar
        style={{
          position: "sticky",
          top: "50px",
        }}
        left={
          <>
            <span>
              {charts.length} eligible charts from {songs.size} songs (of{" "}
              {gameData.songs.length} total)
            </span>
            {configState.flags.length > 0 && !isNarrow && (
              <>
                <Divider orientation="vertical" />
                <EligibleChartsListFilter />
              </>
            )}
          </>
        }
        right={
          <Button
            variant="default"
            aria-label={isNarrow ? "Export Chart Data" : undefined}
            title="Export current chart data as a CSV file"
            leftSection={<IconFileExport size={16} />}
            onClick={exportData}
          >
            {isNarrow ? "" : "Export Chart Data"}
          </Button>
        }
      />
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

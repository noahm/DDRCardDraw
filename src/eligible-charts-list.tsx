import { eligibleCharts, getDrawnChart } from "./card-draw";
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
import { DiffHistogram } from "./histogram";
import { useMemo } from "react";

function songKeyFromChart(chart: DrawnChart) {
  return `${chart.name}:${chart.artist}`;
}

const currentTabAtom = atom("all");

export function EligibleChartsListFilter() {
  const { t } = useIntl();
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const songs = useDrawState((s) => s.gameData?.songs);
  const years = useMemo(() => {
    const years = new Set(songs?.map((s) => s.year));
    years.delete(undefined);
    if (years.size) {
      const ret = Array.from(years as Set<string>).sort((a, b) =>
        a < b ? 1 : -1
      );
      ret.unshift("all");
      return ret;
    }
  }, [songs]);

  if (!years) {
    return null;
  }

  return (
    <HTMLSelect
      value={currentTab}
      onChange={(e) => setCurrentTab(e.currentTarget.value)}
      options={years.map((year) => ({
        value: year,
        label: year === "all" ? "All charts" : year,
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
  let songs = gameData.songs;
  const filteredSongs = songs.filter((chart) => {
    if (isDisplayFiltered && chart.year !== currentTab) {
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
          {currentTab === "all"
            ? `${songs.length} songs available in the game`
            : `${songs.length} songs available from ${currentTab}`}
        </NavbarGroup>
        {configState.flags.size > 0 && !isNarrow && (
          <NavbarGroup>
            <NavbarDivider />
            <EligibleChartsListFilter />
          </NavbarGroup>
        )}
      </Navbar>
      <DiffHistogram songs={gameData.songs} />
      <div className={styles.chartList}>
        {filteredSongs.map((song, idx) => (
          <SongCard chart={getDrawnChart(song, song.charts[3])} key={idx} />
        ))}
      </div>
    </>
  );
}

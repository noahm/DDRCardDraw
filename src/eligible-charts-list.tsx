import { useContext, useState } from "react";
import { eligibleCharts } from "./card-draw";
import { ConfigStateContext } from "./config-state";
import { DrawStateContext } from "./draw-state";
import { SongCard } from "./song-card";
import styles from "./drawing-list.css";
import { DrawnChart } from "./models/Drawing";
import { Text, HTMLSelect } from "@blueprintjs/core";
import { useIntl } from "./hooks/useIntl";

function songKeyFromChart(chart: DrawnChart) {
  return `${chart.name}:${chart.artist}`;
}

export function EligibleChartsList() {
  const { t } = useIntl();
  const [currentTab, setCurrentTab] = useState("all");
  const { gameData } = useContext(DrawStateContext);
  const configState = useContext(ConfigStateContext);
  if (!gameData) {
    return null;
  }
  let charts = Array.from(eligibleCharts(configState, gameData.songs));
  const songs = new Set<string>();
  const allFlags = new Set<string>(["all"]);
  const cards = charts.map((chart, index) => {
    songs.add(songKeyFromChart(chart));
    for (const flag of chart.flags || []) {
      allFlags.add(flag);
    }
    if (currentTab !== "all" && chart.flags.every((f) => f !== currentTab)) {
      return null;
    }
    return <SongCard chart={chart} key={index} />;
  });
  return (
    <>
      <Text tagName="p" style={{ padding: "1em 0 0 1em" }}>
        Eligible songs: {songs.size} of {gameData.songs.length} total (
        {charts.length} eligible charts)
      </Text>
      {allFlags.size > 1 && (
        <div style={{ paddingLeft: "1em" }}>
          <HTMLSelect
            value={currentTab}
            onChange={(e) => setCurrentTab(e.currentTarget.value)}
            options={Array.from(allFlags).map((flag) => ({
              value: flag,
              label: flag === "all" ? "All charts" : t(`meta.${flag}`),
            }))}
          />
        </div>
      )}
      <div className={styles.scrollable}>
        <div className={styles.chartList}>{cards}</div>
      </div>
    </>
  );
}

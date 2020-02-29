import classNames from "classnames";
import { MetaString, AbbrDifficulty } from "./game-data-utils";
import { useDifficultyColor } from "./hooks/useDifficultyColor";
import styles from "./chart-list.css";
import { Chart, Song } from "./models/SongData";
import { useChartFilter } from "./hooks/useChartFilter";
import { ShockBadge } from "./song-card/shock-badge";

interface Props {
  song: Song;
  /**
   * Filter out charts that don't match current filters
   */
  filter?: boolean;
  onClickChart?: (chart: Chart) => void;
}

export function ChartList({ filter, onClickChart, song }: Props) {
  const filterFunc = useChartFilter();
  let charts = song.charts.slice();
  if (filter) {
    charts = charts.filter(chart => filterFunc(song, chart));
    if (!charts.length) {
      return <p>No charts match config</p>;
    }
  }
  charts.sort((a, b) => {
    if (a.style !== b.style) {
      if (a.style < b.style) {
        return 1;
      } else {
        return -1;
      }
    }

    return a.lvl - b.lvl;
  });

  return (
    <ul>
      {/*
      TODO: display all charts that match style, level range, and difficulty classes currently selected
      TBD: how to integrate style + diff class abbreviations like CSP into the new dynamic data format
      */}
      {charts.map(chart => (
        <ChartOption
          key={`${chart.style}:${chart.diffClass}:${chart.lvl}`}
          chart={chart}
          onClick={onClickChart && (() => onClickChart(chart))}
          withStyle={!filter}
        />
      ))}
    </ul>
  );
}

interface ChartOptionProps {
  chart: Chart;
  onClick?: () => void;
  withStyle?: boolean;
}

function ChartOption({ chart, onClick, withStyle }: ChartOptionProps) {
  const bg = useDifficultyColor(chart.diffClass);
  return (
    <div
      className={classNames(styles.chart, styles.dif)}
      style={{ backgroundColor: bg }}
      onClick={onClick}
    >
      {withStyle && (
        <>
          <MetaString field={chart.style} />
          <br />
        </>
      )}
      <AbbrDifficulty diffClass={chart.diffClass} />
      <br />
      {chart.lvl}
      {chart.shock && <ShockBadge />}
    </div>
  );
}

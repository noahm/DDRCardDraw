import classNames from "classnames";
import { MetaString, AbbrDifficulty } from "./game-data-utils";
import { useDifficultyColor } from "./hooks/useDifficultyColor";
import styles from "./chart-list.css";
import { Chart, Song } from "./models/SongData";
import { useChartFilter } from "./hooks/useChartFilter";

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
  let charts = song.charts;
  if (filter) {
    charts = charts.filter(chart => filterFunc(song, chart));
  }
  return (
    <ul>
      {/*
      TODO: display all charts that match style, level range, and difficulty classes currently selected
      TBD: how to integrate style + diff class abbreviations like CSP into the new dynamic data format
      */}
      {song.charts.map(chart => (
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
          <MetaString field={chart.style} />{" "}
        </>
      )}
      <AbbrDifficulty diffClass={chart.diffClass} />
      <br />
      {chart.lvl}
    </div>
  );
}

import { AbbrDifficulty } from "../game-data-utils";
import { chartIsValid, getDrawnChart } from "../card-draw";
import { useDifficultyColor } from "../hooks/useDifficultyColor";
import { useIntl } from "../hooks/useIntl";
import { ConfigState } from "../config-state";
import { DrawnChart } from "../models/Drawing";
import { Chart, Song } from "../models/SongData";
import { SongJacket } from "../song-jacket";
import styles from "./song-search.css";

interface ChartOptionProps {
  chart: Chart;
  onClick: () => void;
}

function ChartOption({ chart, onClick }: ChartOptionProps) {
  const bg = useDifficultyColor(chart.diffClass);
  return (
    <div
      className={styles.chart}
      style={{ backgroundColor: bg }}
      onClick={onClick}
    >
      <AbbrDifficulty diffClass={chart.diffClass} />
      <br />
      {chart.lvl}
    </div>
  );
}

interface ResultsProps {
  song: Song;
  config: ConfigState;
  onSelect: (chart: DrawnChart) => void;
}

export function SearchResult({ config, song, onSelect }: ResultsProps) {
  const validCharts = song.charts.filter(chartIsValid.bind(undefined, config));
  const { t } = useIntl();

  return (
    <div className={styles.suggestion}>
      <SongJacket song={song} height={50} className={styles.img} />
      <div className={styles.title}>
        {song.name_translation || song.name}
        <br />
        {song.artist_translation || song.artist}
      </div>
      {validCharts.map((chart) => (
        <ChartOption
          key={`${chart.style}:${chart.diffClass}:${chart.lvl}`}
          chart={chart}
          onClick={() => onSelect(getDrawnChart(song, chart))}
        />
      ))}
      {validCharts.length === 0 && (
        <div className={styles.noChart}>{t("noValidCharts")}</div>
      )}
    </div>
  );
}

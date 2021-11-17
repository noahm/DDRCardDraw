import { AbbrDifficulty } from "../game-data-utils";
import { chartIsValid, getDrawnChart } from "../card-draw";
import { useDifficultyColor } from "../hooks/useDifficultyColor";
import { useIntl } from "../hooks/useIntl";
import { ConfigState } from "../config-state";
import { DrawnChart } from "../models/Drawing";
import { Song, Chart } from "../models/SongData";
import { SongJacket } from "../song-jacket";
import styles from "./song-search.css";
import { MenuItem } from "@blueprintjs/core";

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
  selected: boolean;
  onSelect(chart: DrawnChart): void;
  config: ConfigState;
}

export function SearchResult({
  song,
  selected,
  onSelect,
  config,
}: ResultsProps) {
  const validCharts = song.charts.filter(chartIsValid.bind(undefined, config));
  const { t } = useIntl();

  return (
    <MenuItem
      selected={selected}
      icon={<SongJacket song={song} height={26} className={styles.img} />}
      text={song.name_translation || song.name}
      label={song.artist_translation || song.artist}
    >
      {validCharts.map((chart) => (
        <MenuItem
          onClick={() => onSelect(getDrawnChart(song, chart))}
          key={`${chart.style}:${chart.diffClass}:${chart.lvl}`}
          text={
            <>
              <AbbrDifficulty diffClass={chart.diffClass} /> {chart.lvl}
            </>
          }
        />
      ))}
    </MenuItem>
  );
}

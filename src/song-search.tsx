import { useContext, useState, useRef, useLayoutEffect } from "react";
import { DrawStateContext } from "./draw-state";
import styles from "./song-search.css";
import { getDrawnChart, songIsValid, chartIsValid } from "./card-draw";
import { DrawnChart } from "./models/Drawing";
import { Modal } from "./modal";
import { Song, Chart } from "./models/SongData";
import { AbbrDifficulty } from "./game-data-utils";
import { useDifficultyColor } from "./hooks/useDifficultyColor";
import { ConfigStateContext, ConfigState } from "./config-state";
import { SongJacket } from "./song-jacket";
import { useIntl } from "./hooks/useIntl";

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

function SearchResult({ config, song, onSelect }: ResultsProps) {
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

interface Props {
  autofocus?: boolean;
  onSongSelect: (song: DrawnChart) => void;
  onCancel: () => void;
}

export function SongSearch(props: Props) {
  const { autofocus, onSongSelect, onCancel } = props;
  const [searchTerm, updateSearchTerm] = useState("");
  const config = useContext(ConfigStateContext);

  const { fuzzySearch } = useContext(DrawStateContext);
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (autofocus && input.current) {
      input.current!.focus();
    }
  }, []);

  let contents: JSX.Element[] | string | null = null;
  if (!fuzzySearch) {
    contents = "Search is not loaded right now.";
  } else if (searchTerm) {
    contents = fuzzySearch
      .search(searchTerm)
      .filter(songIsValid.bind(undefined, config))
      .slice(0, 5)
      .map((song, idx) => (
        <SearchResult
          key={idx}
          config={config}
          song={song}
          onSelect={onSongSelect}
        />
      ));
  }

  return (
    <Modal onClose={onCancel}>
      <div className={styles.input}>
        <input
          placeholder="Search for a song"
          ref={input}
          type="search"
          onKeyUp={(e) => {
            if (e.keyCode === 27) {
              updateSearchTerm("");
              onCancel && onCancel();
            } else if (e.currentTarget.value !== searchTerm) {
              updateSearchTerm(e.currentTarget.value);
            }
          }}
          value={searchTerm}
        />
      </div>
      <div className={styles.suggestionSet}>{contents}</div>
    </Modal>
  );
}

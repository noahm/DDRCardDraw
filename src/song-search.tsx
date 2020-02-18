import classNames from "classnames";
import { useContext, useState, useRef, useLayoutEffect } from "preact/hooks";
import { DrawStateContext } from "./draw-state";
import styles from "./song-search.css";
import { getDrawnChart } from "./card-draw";
import { DrawnChart } from "./models/Drawing";
import { Modal } from "./modal";
import FuzzySearch from "fuzzy-search";
import { Song, GameData, Chart } from "./models/SongData";
import { AbbrDifficulty } from "./game-data-utils";
import { useDifficultyColor } from "./hooks/useDifficultyColor";

interface ChartOptionProps {
  chart: Chart;
  onClick: () => void;
}

function ChartOption({ chart, onClick }: ChartOptionProps) {
  const bg = useDifficultyColor(chart.diffClass);
  return (
    <div
      className={classNames(styles.chart, styles.dif)}
      style={{ backgroundColor: bg }}
      onClick={onClick}
    >
      <AbbrDifficulty diffClass={chart.diffClass} />
      <br />
      {chart.lvl}
    </div>
  );
}

function getSuggestions(
  fuzzySearch: FuzzySearch<Song>,
  searchTerm: string,
  onSelect: (chart: DrawnChart) => void
) {
  if (fuzzySearch && searchTerm) {
    const suggestions = fuzzySearch.search(searchTerm).slice(0, 5);
    if (suggestions.length) {
      return suggestions.map(song => (
        <div className={styles.suggestion}>
          <img src={`jackets/${song.jacket}`} className={styles.img} />
          <div className={styles.title}>
            {song.name_translation || song.name}
            <br />
            {song.artist_translation || song.artist}
          </div>
          {/*
          TODO: display all charts that match style, level range, and difficulty classes currently selected
          TBD: how to integrate style + diff class abbreviations like CSP into the new dynamic data format
          */}
          {song.charts
            .filter(c => c.style === "single" && c.lvl >= 12)
            .map(chart => (
              <ChartOption
                key={`${chart.style}:${chart.diffClass}:${chart.lvl}`}
                chart={chart}
                onClick={() => onSelect(getDrawnChart(song, chart))}
              />
            ))}
        </div>
      ));
    }
  }
  return null;
}

interface Props {
  autofocus?: boolean;
  onSongSelect: (song: DrawnChart) => void;
  onCancel: () => void;
}

export function SongSearch(props: Props) {
  const { autofocus, onSongSelect, onCancel } = props;
  const [searchTerm, updateSearchTerm] = useState("");

  const { fuzzySearch } = useContext(DrawStateContext);
  const input = useRef<HTMLInputElement>();
  useLayoutEffect(() => {
    if (autofocus && input.current) {
      input.current!.focus();
    }
  }, []);

  return (
    <Modal onClose={onCancel}>
      <div className={styles.input}>
        <input
          placeholder="Search for a song"
          ref={input}
          type="search"
          onKeyUp={e => {
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
      <div className={styles.suggestionSet}>
        {fuzzySearch
          ? getSuggestions(fuzzySearch, searchTerm, onSongSelect)
          : "Search is not loaded right now."}
      </div>
    </Modal>
  );
}

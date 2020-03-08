import { useContext, useState, useRef, useLayoutEffect } from "preact/hooks";
import { DrawStateContext } from "./draw-state";
import styles from "./song-search.css";
import { Song, Chart } from "./models/SongData";
import { SongList } from "./song-list";
import { RenderableProps } from "preact";

interface Props {
  autofocus?: boolean;
  onChartSelect?: (song: Song, chart: Chart) => void;
  onSongSelect?: (song: Song) => void;
  filterCharts?: boolean;
  showCharts?: boolean;
}

export function SongSearch(props: RenderableProps<Props>) {
  const {
    autofocus,
    onChartSelect,
    onSongSelect,
    filterCharts,
    showCharts
  } = props;
  const [searchTerm, updateSearchTerm] = useState("");

  const { fuzzySearch } = useContext(DrawStateContext);
  const input = useRef<HTMLInputElement>();
  useLayoutEffect(() => {
    if (autofocus && input.current) {
      input.current!.focus();
    }
  }, []);

  let results: Song[] = [];
  if (fuzzySearch && searchTerm) {
    results = fuzzySearch.search(searchTerm).slice(0, 10);
  }

  return (
    <>
      <div className={styles.input}>
        <input
          placeholder="Search for a song"
          ref={input}
          type="search"
          onKeyUp={e => {
            if (e.keyCode === 27) {
              e.preventDefault();
              updateSearchTerm("");
            } else if (e.currentTarget.value !== searchTerm) {
              updateSearchTerm(e.currentTarget.value);
            }
          }}
          value={searchTerm}
        />
        {props.children}
      </div>
      <div className={styles.suggestionSet}>
        {fuzzySearch ? (
          <SongList
            songs={results}
            showCharts={showCharts}
            filterCharts={filterCharts}
            onSelectChart={onChartSelect}
            onSelect={onSongSelect}
          />
        ) : (
          "Search is not loaded right now."
        )}
      </div>
    </>
  );
}

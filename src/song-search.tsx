import { useContext, useState, useRef, useLayoutEffect } from "preact/hooks";
import { DrawStateContext } from "./draw-state";
import styles from "./song-search.css";
import { Modal } from "./modal";
import FuzzySearch from "fuzzy-search";
import { Song, Chart } from "./models/SongData";
import { ChartList } from "./chart-list";

function getSuggestions(
  fuzzySearch: FuzzySearch<Song>,
  searchTerm: string,
  onSelect: (song: Song, chart: Chart) => void,
  filter: boolean
) {
  if (fuzzySearch && searchTerm) {
    const suggestions = fuzzySearch.search(searchTerm).slice(0, 5);
    if (suggestions.length) {
      return suggestions.map(song => (
        <div className={styles.suggestion}>
          <img src={`/jackets/${song.jacket}`} className={styles.img} />
          <div className={styles.title}>
            {song.name_translation || song.name}
            <br />
            {song.artist_translation || song.artist}
          </div>
          <ChartList
            song={song}
            filter={filter}
            onClickChart={onSelect.bind(undefined, song)}
          />
        </div>
      ));
    }
  }
  return null;
}

interface Props {
  autofocus?: boolean;
  onSongSelect: (song: Song, chart: Chart) => void;
  filter?: boolean;
}

export function SongSearch(props: Props) {
  const { autofocus, onSongSelect, filter } = props;
  const [searchTerm, updateSearchTerm] = useState("");

  const { fuzzySearch } = useContext(DrawStateContext);
  const input = useRef<HTMLInputElement>();
  useLayoutEffect(() => {
    if (autofocus && input.current) {
      input.current!.focus();
    }
  }, []);

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
      </div>
      <div className={styles.suggestionSet}>
        {fuzzySearch
          ? getSuggestions(fuzzySearch, searchTerm, onSongSelect, !!filter)
          : "Search is not loaded right now."}
      </div>
    </>
  );
}

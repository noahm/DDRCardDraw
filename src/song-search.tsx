import { useContext, useState, useRef, useLayoutEffect } from "preact/hooks";
import { DrawStateContext } from "./draw-state";
import styles from "./song-search.css";
import FuzzySearch from "fuzzy-search";
import { Song, Chart } from "./models/SongData";
import { SongList } from "./song-list";

function getSuggestions(
  fuzzySearch: FuzzySearch<Song>,
  searchTerm: string,
  onSelect: (song: Song, chart: Chart) => void,
  filter: boolean
) {
  if (fuzzySearch && searchTerm) {
    const suggestions = fuzzySearch.search(searchTerm).slice(0, 10);
    if (suggestions.length) {
      return (
        <SongList songs={suggestions} filter={filter} onSelect={onSelect} />
      );
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

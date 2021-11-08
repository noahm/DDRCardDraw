import { useContext, useLayoutEffect, useRef, useState } from "react";
import { songIsValid } from "../card-draw";
import { ConfigStateContext } from "../config-state";
import { DrawStateContext } from "../draw-state";
import { DrawnChart } from "../models/Drawing";
import { Song } from "../models/SongData";
import { SearchResult } from "./search-result";
import styles from "./song-search.css";
import { Dialog, InputGroup } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";

interface Props {
  autofocus?: boolean;
  onSongSelect: (song: Song, chart: DrawnChart) => void;
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
          onSelect={(chart) => onSongSelect(song, chart)}
        />
      ));
  }

  return (
    <Dialog onClose={onCancel} isOpen>
      <div className={styles.input}>
        <InputGroup
          placeholder="Search for a song"
          inputRef={input}
          leftIcon={IconNames.SEARCH}
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
    </Dialog>
  );
}

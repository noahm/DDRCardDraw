import { useContext, useLayoutEffect, useRef, useState } from "react";
import { songIsValid } from "../card-draw";
import { ConfigStateContext } from "../config-state";
import { DrawStateContext } from "../draw-state";
import { DrawnChart } from "../models/Drawing";
import { Song } from "../models/SongData";
import { SearchResult } from "./search-result";
import { InputGroup } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Omnibar } from "@blueprintjs/select";

interface Props {
  isOpen: boolean;
  onSongSelect(song: Song, chart: DrawnChart): void;
  onCancel(): void;
}

export function SongSearch(props: Props) {
  const { isOpen, onSongSelect, onCancel } = props;
  const [searchTerm, updateSearchTerm] = useState("");
  const config = useContext(ConfigStateContext);

  const { fuzzySearch } = useContext(DrawStateContext);

  let items: Song[] = [];
  if (fuzzySearch) {
    items = fuzzySearch
      .search(searchTerm)
      .filter(songIsValid.bind(undefined, config));
  }

  return (
    <Omnibar
      isOpen={isOpen}
      onClose={onCancel}
      query={searchTerm}
      onQueryChange={updateSearchTerm}
      onItemSelect={() => null}
      items={items}
      inputProps={{ placeholder: "Find a song..." }}
      itemRenderer={(song, itemProps) => (
        <SearchResult
          config={config}
          song={song}
          selected={itemProps.modifiers.active}
          onSelect={(chart) => (
            onSongSelect(song, chart), updateSearchTerm("")
          )}
        />
      )}
    />
  );
}

import { useContext, useLayoutEffect, useRef, useState } from "react";
import { chartIsValid, getDrawnChart, songIsValid } from "../card-draw";
import { ConfigStateContext } from "../config-state";
import { DrawStateContext } from "../draw-state";
import { DrawnChart } from "../models/Drawing";
import { Song } from "../models/SongData";
import { SearchResult, SearchResultData } from "./search-result";
import { InputGroup } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Omnibar } from "@blueprintjs/select";

interface Props {
  isOpen: boolean;
  onSongSelect(song: Song, chart?: DrawnChart): void;
  onCancel(): void;
}

export function SongSearch(props: Props) {
  const { isOpen, onSongSelect, onCancel } = props;
  const [searchTerm, updateSearchTerm] = useState("");
  const config = useContext(ConfigStateContext);

  const { fuzzySearch } = useContext(DrawStateContext);

  let items: SearchResultData[] = [];
  if (fuzzySearch) {
    const songs = fuzzySearch
      .search(searchTerm)
      .filter(songIsValid.bind(undefined, config))
      .slice(0, 15);
    for (const song of songs) {
      const validCharts = song.charts.filter(
        chartIsValid.bind(undefined, config)
      );
      for (const chart of validCharts) {
        items.push({ song, chart });
      }
      if (!validCharts.length) {
        items.push({ song, chart: "none" });
      }
    }
    items = items.slice(0, 15);
  }

  return (
    <Omnibar
      isOpen={isOpen}
      onClose={onCancel}
      query={searchTerm}
      onQueryChange={updateSearchTerm}
      onItemSelect={(item) =>
        onSongSelect(
          item.song,
          item.chart === "none" || !item.chart
            ? undefined
            : getDrawnChart(item.song, item.chart)
        )
      }
      items={items}
      inputProps={{
        placeholder: "Find a song...",
        style: { maxWidth: "calc(100vw - 2em)" },
      }}
      itemRenderer={(data, itemProps) => (
        <SearchResult
          config={config}
          data={data}
          selected={itemProps.modifiers.active}
          handleClick={itemProps.handleClick}
        />
      )}
    />
  );
}

import { useState } from "react";
import { chartIsValid, getDrawnChart, songIsValid } from "../card-draw";
import { useConfigState } from "../config-state";
import { useDrawState } from "../draw-state";
import { EligibleChart } from "../models/Drawing";
import { Song } from "../models/SongData";
import { SearchResult, SearchResultData } from "./search-result";
import { Omnibar } from "@blueprintjs/select";
import styles from "./song-search.css";

interface Props {
  isOpen: boolean;
  onSongSelect(song: Song, chart?: EligibleChart): void;
  onCancel(): void;
}

export function SongSearch(props: Props) {
  const { isOpen, onSongSelect, onCancel } = props;
  const [searchTerm, updateSearchTerm] = useState("");
  const config = useConfigState();
  const fuzzySearch = useDrawState((s) => s.fuzzySearch);

  let items: SearchResultData[] = [];
  if (fuzzySearch) {
    const songs = fuzzySearch
      .search(searchTerm)
      .filter((song) => songIsValid(config, song, true))
      .slice(0, 30);
    for (const song of songs) {
      const validCharts = song.charts.filter((chart) =>
        chartIsValid(config, chart, true)
      );
      for (const chart of validCharts) {
        items.push({ song, chart });
      }
      if (!validCharts.length) {
        items.push({ song, chart: "none" });
      }
    }
    items = items.slice(0, config.constrainPocketPicks ? 30 : 15);
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
            : getDrawnChart(
                useDrawState.getState().gameData!,
                item.song,
                item.chart
              )
        )
      }
      items={items}
      inputProps={{
        placeholder: "Find a song...",
      }}
      className={styles.songSearch}
      itemRenderer={(data, itemProps) => (
        <SearchResult
          data={data}
          selected={itemProps.modifiers.active}
          handleClick={itemProps.handleClick}
        />
      )}
    />
  );
}

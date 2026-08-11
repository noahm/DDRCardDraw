import { useMemo, useState } from "react";
import { chartIsValid, getDrawnChart, songIsValid } from "../card-draw";
import { useConfigState } from "../config-state";
import { useDrawState } from "../draw-state";
import { EligibleChart } from "../models/Drawing";
import { Song } from "../models/SongData";
import { SearchResult, SearchResultData } from "./search-result";
import { Omnibar } from "@blueprintjs/select";
import fuzzysort from "fuzzysort";
import { getSongSearchIndex } from "./search-index";
import styles from "./song-search.css";

interface Props {
  isOpen: boolean;
  onSongSelect(this: void, song: Song, chart?: EligibleChart): void;
  onCancel(this: void): void;
}

export function SongSearch(props: Props) {
  const { isOpen, onSongSelect, onCancel } = props;
  const [searchTerm, updateSearchTerm] = useState("");
  const config = useConfigState();
  const gameData = useDrawState((s) => s.gameData);
  const songSearchIndex = useMemo(
    () => (gameData ? getSongSearchIndex(gameData) : null),
    [gameData],
  );
  const overlayProps = useMemo(
    () => ({
      // Reset once the overlay has finished fading out. Clearing as soon as it
      // starts to close would refill the list with unfiltered results behind
      // the fade, since an empty query matches every song.
      onClosed: () => updateSearchTerm(""),
    }),
    [],
  );

  let items: SearchResultData[] = [];
  // An empty query matches every song, so skip it entirely rather than ranking
  // and filtering the whole list for a result set the omnibar won't render.
  if (songSearchIndex && searchTerm) {
    const songs = fuzzysort
      // threshold 0 keeps every subsequence match, ranked best-first
      .go(searchTerm, songSearchIndex, { limit: 0, threshold: 0 })
      .map((result) => result.obj)
      .filter((song) => songIsValid(config, song, true))
      .slice(0, 30);
    for (const song of songs) {
      const validCharts = song.charts.filter((chart) =>
        chartIsValid(config, chart, true),
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
                item.chart,
              ),
        )
      }
      items={items}
      overlayProps={overlayProps}
      inputProps={{
        placeholder: "Find a song...",
      }}
      className={styles.songSearch}
      itemRenderer={(data, itemProps) => (
        <SearchResult
          key={`${data.song.saHash || data.song.name}-${
            typeof data.chart === "string" ? data.chart : data.chart.diffClass
          }`}
          data={data}
          selected={itemProps.modifiers.active}
          handleClick={itemProps.handleClick}
        />
      )}
    />
  );
}

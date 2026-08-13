import { useState } from "react";
import { chartIsValid, getDrawnChart, songIsValid } from "../card-draw";
import { useConfigState, useGameData } from "../state/hooks";
import { EligibleChart } from "../models/Drawing";
import { Song, Chart } from "../models/SongData";
import { SearchResult, SearchResultData } from "./search-result";
import { Omnibar } from "@blueprintjs/select";
import styles from "./song-search.css";
import { useFuzzySearch } from "../hooks/useFuzzySearch";
import { readExtra } from "../utils/extras";
import { EDIT_ID_KEY } from "../utils/smx-edit-import";

interface Props {
  isOpen: boolean;
  onSongSelect(this: void, song: Song, chart?: EligibleChart): void;
  onCancel(this: void): void;
}

/**
 * A stable identity for a chart within one song. Normal charts are unique by
 * style+diffClass, but edit charts all share `diffClass: "edit"`, so we also key
 * on level and the edit's share id. This both distinguishes genuinely different
 * edits and lets us collapse the same edit grafted onto a song more than once.
 */
function chartIdentity(chart: Chart): string {
  return [
    chart.style,
    chart.diffClass,
    chart.lvl,
    readExtra(chart.extras, EDIT_ID_KEY) ?? "",
  ].join("\0");
}

export function SongSearch(props: Props) {
  const { isOpen, onSongSelect, onCancel } = props;
  const [searchTerm, updateSearchTerm] = useState("");
  const config = useConfigState();
  const gameData = useGameData();
  const fuzzySearch = useFuzzySearch();

  let items: SearchResultData[] = [];
  if (fuzzySearch) {
    const songs = fuzzySearch
      .search(searchTerm)
      .map((entry) => entry.song)
      .filter((song) => songIsValid(config, song, true))
      .slice(0, 30);
    for (const song of songs) {
      const seen = new Set<string>();
      const validCharts = song.charts.filter((chart) => {
        if (!chartIsValid(config, chart, true)) return false;
        const identity = chartIdentity(chart);
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
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
            : getDrawnChart(gameData!, item.song, item.chart),
        )
      }
      items={items}
      inputProps={{
        placeholder: "Find a song...",
      }}
      className={styles.songSearch}
      itemRenderer={(data, itemProps) => (
        <SearchResult
          key={`${data.song.saHash || data.song.name}-${
            typeof data.chart === "string"
              ? data.chart
              : chartIdentity(data.chart)
          }`}
          data={data}
          selected={itemProps.modifiers.active}
          handleClick={itemProps.handleClick}
        />
      )}
    />
  );
}

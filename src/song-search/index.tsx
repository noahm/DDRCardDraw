import { useState } from "react";
import { Modal, ScrollArea, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { chartIsValid, getDrawnChart, songIsValid } from "../card-draw";
import { useConfigState, useGameData } from "../state/hooks";
import { EligibleChart } from "../models/Drawing";
import { Song } from "../models/SongData";
import { SearchResult, SearchResultData } from "./search-result";
import styles from "./song-search.css";
import { useFuzzySearch } from "../hooks/useFuzzySearch";

interface Props {
  isOpen: boolean;
  onSongSelect(this: void, song: Song, chart?: EligibleChart): void;
  onCancel(this: void): void;
}

export function SongSearch(props: Props) {
  const { isOpen, onSongSelect, onCancel } = props;
  const [searchTerm, updateSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const config = useConfigState();
  const gameData = useGameData();
  const fuzzySearch = useFuzzySearch();

  function resetSearch() {
    updateSearchTerm("");
    setActiveIndex(0);
  }

  let items: SearchResultData[] = [];
  if (fuzzySearch && isOpen) {
    const songs = fuzzySearch
      .search(searchTerm)
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

  function selectItem(item: SearchResultData) {
    resetSearch();
    onSongSelect(
      item.song,
      item.chart === "none" || !item.chart
        ? undefined
        : getDrawnChart(gameData!, item.song, item.chart),
    );
  }

  /** step from `start` in `direction` to the next selectable result */
  function nextEnabledIndex(start: number, direction: 1 | -1) {
    for (let i = start; i >= 0 && i < items.length; i += direction) {
      if (items[i].chart !== "none") {
        return i;
      }
    }
    return start - direction;
  }

  return (
    <Modal
      opened={isOpen}
      onClose={() => {
        resetSearch();
        onCancel();
      }}
      withCloseButton={false}
      padding="xs"
      className={styles.songSearch}
    >
      <TextInput
        placeholder="Find a song..."
        leftSection={<IconSearch size={16} />}
        value={searchTerm}
        data-autofocus
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          updateSearchTerm(e.currentTarget.value);
          setActiveIndex(0);
        }}
        onKeyDown={(e) => {
          switch (e.key) {
            case "ArrowDown":
              e.preventDefault();
              setActiveIndex((prev) =>
                Math.min(nextEnabledIndex(prev + 1, 1), items.length - 1),
              );
              break;
            case "ArrowUp":
              e.preventDefault();
              setActiveIndex((prev) =>
                Math.max(nextEnabledIndex(prev - 1, -1), 0),
              );
              break;
            case "Enter":
              if (items[activeIndex] && items[activeIndex].chart !== "none") {
                selectItem(items[activeIndex]);
              }
              break;
          }
        }}
      />
      <ScrollArea.Autosize mah="60vh" mt="xs">
        {items.map((data, idx) => (
          <SearchResult
            key={`${data.song.saHash || data.song.name}-${
              typeof data.chart === "string" ? data.chart : data.chart.diffClass
            }`}
            data={data}
            selected={idx === activeIndex}
            handleClick={(e) => {
              e.stopPropagation();
              selectItem(data);
            }}
          />
        ))}
      </ScrollArea.Autosize>
    </Modal>
  );
}

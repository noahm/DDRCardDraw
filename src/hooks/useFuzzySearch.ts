import FuzzySearch from "fuzzy-search";
import { useGameData } from "../state/hooks";
import { useMemo } from "react";

export function useFuzzySearch() {
  const gameData = useGameData();
  return useMemo(
    () =>
      !gameData
        ? null
        : new FuzzySearch(
            gameData.songs,
            [
              "name",
              "name_translation",
              "search_hint",
              "artist",
              "artist_translation",
            ],
            {
              sort: true,
            },
          ),
    [gameData],
  );
}

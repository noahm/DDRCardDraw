import FuzzySearch from "fuzzy-search";
import { useGameData } from "../state/hooks";

export function useFuzzySearch() {
  const gameData = useGameData();
  if (!gameData) return null;
  return new FuzzySearch(
    gameData.songs,
    ["name", "name_translation", "search_hint", "artist", "artist_translation"],
    {
      sort: true,
    },
  );
}

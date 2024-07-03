import FuzzySearch from "fuzzy-search";
import { useAppState } from "../state/store";

export function useFuzzySearch() {
  const gameData = useAppState((s) => s.gameData.gameData);
  if (!gameData) return null;
  return new FuzzySearch(
    gameData.songs,
    ["name", "name_translation", "search_hint", "artist", "artist_translation"],
    {
      sort: true,
    },
  );
}

import FuzzySearch from "fuzzy-search";
import { useAtomValue } from "jotai";
import { gameDataAtom } from "../state/game-data.atoms";

export function useFuzzySearch() {
  const gameData = useAtomValue(gameDataAtom);
  if (!gameData) return null;
  return new FuzzySearch(
    gameData.songs,
    ["name", "name_translation", "search_hint", "artist", "artist_translation"],
    {
      sort: true,
    },
  );
}

import FuzzySearch from "fuzzy-search";
import { useGameData } from "../state/hooks";
import { useMemo } from "react";
import { Song } from "../models/SongData";
import { readExtra } from "../utils/extras";
import { EDIT_AUTHOR_KEY } from "../utils/smx-edit-import";

/**
 * A song paired with a derived, whitespace-joined string of every edit author
 * across its charts. We index the wrapper (rather than the bare song) so edit
 * authors are searchable without stuffing the `editAuthor:` prefix from `extras`
 * into the haystack, which would otherwise match on the prefix itself.
 */
interface SearchEntry {
  song: Song;
  editAuthors: string;
}

export function useFuzzySearch() {
  const gameData = useGameData();
  return useMemo(() => {
    if (!gameData) return null;
    const entries: SearchEntry[] = gameData.songs.map((song) => ({
      song,
      editAuthors: song.charts
        .map((chart) => readExtra(chart.extras, EDIT_AUTHOR_KEY))
        .filter((author): author is string => !!author)
        .join(" "),
    }));
    return new FuzzySearch(
      entries,
      [
        "song.name",
        "song.name_translation",
        "song.search_hint",
        "song.artist",
        "song.artist_translation",
        "editAuthors",
      ],
      {
        sort: true,
      },
    );
  }, [gameData]);
}

import fuzzysort, { type SnapshotKeys } from "fuzzysort";
import { GameData, Song } from "../models/SongData";

const SEARCH_KEYS = [
  "name",
  "name_translation",
  "search_hint",
  "artist",
  "artist_translation",
];

const indexes = new WeakMap<GameData, SnapshotKeys<Song>>();

/**
 * Indexing a song list costs roughly 40ms, so hold onto one index per loaded
 * game data set. This lives alongside the search UI rather than in the draw
 * state so that fuzzysort ships in the lazily loaded search chunk.
 */
export function getSongSearchIndex(gameData: GameData) {
  let index = indexes.get(gameData);
  if (!index) {
    index = fuzzysort.snapshot(gameData.songs, { keys: SEARCH_KEYS });
    indexes.set(gameData, index);
  }
  return index;
}

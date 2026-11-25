import fuzzysort, {
  type Key,
  type KeysResult,
  type SnapshotKeys,
} from "fuzzysort";
import { GameData, Song } from "../models/SongData";
import { readExtra } from "../utils/extras";
import { EDIT_AUTHOR_KEY } from "../utils/smx-edit-import";

/**
 * Every edit author across a song's charts, whitespace joined. Derived by hand
 * rather than indexed as a key path so the `editAuthor:` prefix that `extras`
 * uses stays out of the haystack, where it would otherwise match on itself.
 */
function editAuthorsOf(song: Song) {
  return song.charts
    .map((chart) => readExtra(chart.extras, EDIT_AUTHOR_KEY))
    .filter((author): author is string => !!author)
    .join(" ");
}

const SEARCH_KEYS: Key<Song>[] = [
  "name",
  "name_translation",
  "search_hint",
  "artist",
  "artist_translation",
  editAuthorsOf,
];

/** Positions within SEARCH_KEYS. scoreSongMatch depends on this order. */
const TITLE_KEYS = [0, 1, 2];
/** Keys naming a person rather than the song itself: artists and edit authors. */
const CREDIT_KEYS = [3, 4, 5];

/**
 * How far to demote a song whose best match came from a credit field instead
 * of a title. Without this, every key counts the same, so a short query like
 * "a" fills the list with songs by artists whose names are a close match --
 * A応P, ASKA, aran -- while "A Brighter Day" sits a hundred rows down.
 *
 * Kept mild on purpose: searching by artist is a normal thing to do here, and
 * a harsher weight pushes songs that merely mention an artist in their title
 * above that artist's actual songs.
 */
const CREDIT_MATCH_WEIGHT = 0.8;

function bestScoreOf(result: KeysResult<Song>, keys: number[]) {
  return Math.max(...keys.map((i) => fuzzysort.score(result[i]) || 0));
}

/**
 * Scales fuzzysort's own combined score rather than recomputing one from the
 * per-key scores: its merge gives a bonus to songs that match on several keys
 * at once, and taking a plain weighted max would throw that away.
 */
export function scoreSongMatch(result: KeysResult<Song>) {
  const creditMatchedBest =
    bestScoreOf(result, CREDIT_KEYS) > bestScoreOf(result, TITLE_KEYS);
  return (
    fuzzysort.score(result) * (creditMatchedBest ? CREDIT_MATCH_WEIGHT : 1)
  );
}

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

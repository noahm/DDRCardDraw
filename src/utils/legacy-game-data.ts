import type { GameData } from "../models/SongData";

/** a song as published before schema v2, when it had no required `id` */
interface LegacySong {
  id?: string;
  name: string;
  artist: string;
  saHash?: string;
  saIndex?: string;
}

/**
 * Bundles published before schema v2 identify songs by `saHash`/`saIndex`
 * rather than a required `id`, and they're immutable, so they're brought up to
 * v2 as they load. Mutates and returns `data`.
 *
 * Each song's `id` is its `saHash`, else its `saIndex` (an SMX bundle's 573.no
 * `song_id`, which the score import matches on), else its name and artist. That
 * last one is exactly what a song without either was keyed on before, so its
 * charts keep the keys rooms already stored for them. Should a bundle list the
 * same name and artist twice, later copies get a `#2`/`#3` suffix, since ids
 * are unique within a file.
 */
export function upgradeLegacyGameData(data: GameData): GameData {
  const songs = data.songs as unknown as LegacySong[];
  if (!Array.isArray(songs) || songs.every((song) => song.id)) {
    return data;
  }
  const taken = new Set(songs.map((song) => song.id).filter(Boolean));
  for (const song of songs) {
    if (!song.id) {
      const base = song.saHash || song.saIndex || `${song.name}|${song.artist}`;
      let id = base;
      for (let n = 2; taken.has(id); n++) {
        id = `${base}#${n}`;
      }
      song.id = id;
      taken.add(id);
    }
    delete song.saHash;
    delete song.saIndex;
  }
  return data;
}

// @ts-check
import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { requestQueue } from "../utils.mjs";
import { format } from "prettier";

/** @typedef {import("../../src/models/SongData.ts").Song} Song */
/** @typedef {import("../../src/models/SongData.ts").Chart} Chart */
/** @typedef {typeof import('./songdata.mjs').ALL_SONG_DATA[number]} SanbaiSong */

/**
 * Mapping from 3icecream's `lock_types` to DDRCardDraw's `flags`
 * @type {Record<number, Song['flags']>}
 */
const lockFlags = {
  20: ["goldExclusive", "tempUnlock"], // BEMANI PRO LEAGUE -SEASON 4- Triple Tribe
  190: ["grandPrixPack"], // DDR GRAND PRIX packs
  240: ["unlock"], // BEMANI PRO LEAGUE -SEASON 5- Triple Tribe 0 (2025-07-17 10:00~2025-08-31 23:59)
  250: ["flareRank"], // FLARE SKILL unlock
  260: ["tempUnlock"], // MYSTICAL Re:UNION
  270: ["worldLeague"], // WORLD LEAGUE
  280: ["unlock"], // EXTRA SAVIOR WORLD
  290: ["unlock"], // GALAXY BRAVE
  300: ["platinumMembers"], // DDR PLATINUM MEMBERS
};

/**
 * Mapping from 3icecream's `version_num` to DDR folder name
 * @type {Record<SanbaiSong['version_num'], Song['folder']>}
 */
const titleList = {
  1: "DanceDanceRevolution 1st Mix",
  2: "DanceDanceRevolution 2nd Mix",
  3: "DanceDanceRevolution 3rd Mix",
  4: "DanceDanceRevolution 4th Mix",
  5: "DanceDanceRevolution 5th Mix",
  6: "DDRMAX -DanceDanceRevolution 6thMIX-",
  7: "DDRMAX2 -DanceDanceRevolution 7thMIX-",
  8: "DanceDanceRevolution EXTREME",
  9: "DanceDanceRevolution SuperNOVA",
  10: "DanceDanceRevolution SuperNOVA2",
  11: "DanceDanceRevolution X",
  12: "DanceDanceRevolution X2",
  13: "DanceDanceRevolution X3 vs 2nd MIX",
  14: "DanceDanceRevolution (2013)",
  15: "DanceDanceRevolution (2014)",
  16: "DanceDanceRevolution A",
  17: "DanceDanceRevolution A20",
  18: "DanceDanceRevolution A20 PLUS",
  19: "DanceDanceRevolution A3",
  20: "DanceDanceRevolution World",
};

/**
 * Correction map for invalid data on 3icecream site
 * @type {Map<SanbaiSong['song_id'], Partial<SanbaiSong>>}
 */
const invalidDataOnSanbai = new Map([
  [
    "oQ0bqIQ8DdPlilO000DQloOo6Od8IdQ6", // Bloody Tears (IIDX EDITION)
    { ratings: [4, 5, 6, 11, 0, 5, 7, 11, 0] },
  ],
  [
    "61QQi8i9Iliq66IOq1ib888b666o08O8", // Mermaid girl
    { ratings: [3, 4, 7, 11, 12, 5, 8, 11, 12] },
  ],
  [
    "PddldblI909IqI8PPiQIo9lIIiQdDo1l", // MEGALOVANIA
    { ratings: [3, 9, 12, 16, 18, 9, 12, 16, 18] },
  ],
  [
    "668Q8qQdqoIQQiIQOilDqd8lDOOQ8bDQ", // パ→ピ→プ→Yeah!
    { lock_types: [0, 0, 0, 0, 280, 0, 0, 0, 280] },
  ],
  [
    "D9lq0DioIl9D6ll0d61990DP9qPPb1dP", // True Blue
    { lock_types: [0, 0, 0, 0, 280, 0, 0, 0, 280] },
  ],
  [
    "o1dbD61Qi98O60liQQ91d8O16I86dqDd", // In The Breeze
    { lock_types: [0, 0, 0, 0, 280, 0, 0, 0, 280] },
  ],
  [
    "q6iD8idqo69qIPl00IQidoq1o1o1d1b9", // クリムゾンゲイト
    { lock_types: [0, 0, 0, 0, 280, 0, 0, 0, 280] },
  ],
  [
    "qo6l9dbb8D0iDQI1odo0Qb9O1ibDdoIb", // Remain
    { lock_types: [0, 0, 0, 0, 280, 0, 0, 0, 280] },
  ],
  [
    "1diQi81loIodIdOlQ8Pd6Qd8b69Q1DP8", // Destiny lovers
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  [
    "1PQdDiqOD6o1b61iiDOoiiblIQbI91Pb", // JET WORLD
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  [
    "60QoP9DoIo90D616989Q0D0iodOoOd91", // SEXY PLANET
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  [
    "9lob1d1QPd9qiPlQOQ6l0dbodOoDPq1d", // think ya better D
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  [
    "i11d86DOOdOb8Pbb1QqIilQI9Idib8PP", // Music In The Rhythm
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  [
    "ii6Oooool0IoOqi1qdDo96QIil6IoOq0", // BURNIN' THE FLOOR
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  [
    "lO68Q0iPIOiOIDDd8dOPoiql9OI81DQ0", // The Least 100sec
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  [
    "PP9QDQ0IQQID00P61d8qdDdP09b19iiI",
    {
      name: "Blind Justice ～Torn souls, Hurt Faiths～",
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  [
    "qIP6DPdbD9iO86i1DO9qDd8l6dPdbl0P", // LOVE♥SHINE
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  [
    "qQ9Oo611P0dObD8q6O0Q968bbl8I91OO", // TRIP MACHINE ～luv mix～
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
]);

export class SanbaiSongImporter {
  /**
   * Get jacket image URL from 3icecream for a song
   * @param {Pick<Song, "saHash">} song Song info with saHash
   */
  getJacketUrl(song) {
    return `https://3icecream.com/img/banners/${song.saHash}.jpg`;
  }

  /**
   * Fetches and converts song data from 3icecream (ALL_SONG_DATA)
   * Applies corrections and returns array for merging
   * @returns {Promise<(Pick<Song, 'name' | 'name_translation' | 'artist' | 'bpm' | 'charts' | 'flags' | 'saHash' | 'search_hint'> & { deleted: boolean })[]>}
   */
  async fetchSongs() {
    await this.updateSongDataFile();
    const { ALL_SONG_DATA } = await import("./songdata.mjs");

    const songs = [];
    for (const song of ALL_SONG_DATA) {
      // Fix invalid data
      const actual = invalidDataOnSanbai.get(song.song_id);
      if (actual) {
        for (const [key, value] of Object.entries(actual)) {
          if (!Array.isArray(value) && value !== song[key]) {
            console.log(
              `Fixing invalid ${key} for ${song.song_name} on 3ice : ${song[key]} -> ${value}`,
            );
            song[key] = value;
          } else if (
            Array.isArray(value) &&
            (value.length !== song[key]?.length ||
              value.some((v, i) => v !== song[key][i]))
          ) {
            console.log(
              `Fixing invalid ${key} for ${song.song_name} on 3ice : ${song[key]} -> ${value}`,
            );
            song[key] = value;
            if (key === "ratings" && Array.isArray(song.tiers)) {
              song.tiers = song.tiers.map(() => 1); // reset tiers
            }
          } else {
            console.warn(
              `No changes needed for ${key} on ${song.song_name}. Consider remove on invalidDataOnSanbai map.`,
            );
          }
        }
      }

      const locks = song.lock_types;
      let songLock = null;
      if (locks) {
        // If all charts are locked, set songLock
        const allChartsLocked = song.ratings.every(
          (lvl, idx) => !lvl || locks[idx],
        );
        if (allChartsLocked) songLock = locks[0];
      }

      // Build charts array from ratings and lock_types
      const ratingsToStyleAndDiff = [
        { style: "single", diffClass: "beginner" },
        { style: "single", diffClass: "basic" },
        { style: "single", diffClass: "difficult" },
        { style: "single", diffClass: "expert" },
        { style: "single", diffClass: "challenge" },
        { style: "double", diffClass: "basic" },
        { style: "double", diffClass: "difficult" },
        { style: "double", diffClass: "expert" },
        { style: "double", diffClass: "challenge" },
      ];
      const charts = song.ratings
        .map((lvl, idx) => {
          /** @type {Chart} */
          const chart = { lvl, ...ratingsToStyleAndDiff[idx] };
          if (locks && locks[idx] && locks[idx] !== songLock) {
            chart.flags = lockFlags[locks[idx]];
          }
          if (song.tiers[idx] && song.tiers[idx] !== 1) {
            chart.sanbaiTier = chart.lvl + song.tiers[idx];
          }
          return chart;
        })
        .filter((c) => !!c.lvl);

      // Push converted song object (include deleted property)
      songs.push({
        name: song.song_name,
        name_translation: song.romanized_name,
        artist: "???",
        folder: titleList[song.version_num - 1],
        bpm: "???",
        charts,
        flags:
          songLock && lockFlags[songLock] ? lockFlags[songLock] : undefined,
        saHash: song.song_id,
        search_hint:
          [song.searchable_name, song.alternate_name]
            .filter(Boolean)
            .join(" ") || undefined,
        deleted: !!song.deleted || false,
      });
    }
    return songs;
  }

  /**
   * Updates the local songdata.mjs file by fetching from 3icecream
   * Formats and saves as ESM
   * @returns {Promise<string>} Path to the updated songdata.mjs file
   * @private
   */
  async updateSongDataFile() {
    const url = "https://3icecream.com/js/songdata.js";
    const jsText = await requestQueue.add(async () => {
      const resp = await fetch(url);
      return await resp.text();
    });
    if (!jsText) return null;

    const mjsText = jsText
      .replace(/\b(const|var)\b/g, "export const")
      .replace(/\u00a0/g, " "); // Replace non-breaking spaces
    const filePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "songdata.mjs",
    );
    const formatted = await format(mjsText, { filepath: filePath });
    await writeFile(filePath, formatted);
    return filePath;
  }
}

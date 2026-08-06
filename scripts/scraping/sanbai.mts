import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "oxfmt";

import { downloadJacket, exists, requestQueue } from "../utils.mts";
import type { Chart, Song } from "../../src/models/SongData.ts";
import type { DDRSongImporter } from "./ddr-sources.mts";

const _currentDate = new Date();

type SanbaiSong = {
  song_id: string;
  song_name: string;
  searchable_name?: string;
  romanized_name?: string;
  alternate_name?: string;
  version_num: number;
  lock_types?: number[];
  deleted?: 1;
  ratings: number[];
  tiers: number[];
};

/**
 * Mapping from 3icecream's `lock_types` to DDRCardDraw's `flags`
 * @description
 * Hidden songs/charts that were already locked as of 2025-10-21 also require the `euLocked` flag.
 */
const lockFlags: Map<number, Song["flags"]> = new Map([
  [1000, ["euLocked"]], // For unlocked songs/charts
  [190, ["grandPrixPack"]], // DDR GRAND PRIX packs
  [240, ["tempUnlock"]], // BEMANI PRO LEAGUE -SEASON 5- Triple Tribe 0 (2025-07-17 10:00~2025-08-31 23:59)
  [250, ["flareRank"]], // FLARE SKILL unlock
  [270, ["worldLeague"]], // WORLD LEAGUE
  [280, ["unlock"]], // EXTRA SAVIOR WORLD
  [290, ["unlock"]], // GALAXY BRAVE
  [300, ["platinumMembers"]], // DDR PLATINUM MEMBERS
  [310, ["tempUnlock"]], // BEMANI PRO LEAGUE -SEASON 5- Triple Tribe (2026-01-29 10:00~2026-03-22 23:59)
  [320, ["tempUnlock"]], // pop'n & BEMANI Cheers × Cheers!! (2026-02-26 10:00~2026-03-22 23:59)
  [330, ["tempUnlock"]], // BEMANI PRO LEAGUE -SEASON 5- Triple Tribe Append (2026-03-26 10:00~2026-04-26 23:59)
  [350, ["unlock"]], // 段位認定(DAN RANK)
  [
    360,
    _currentDate <= new Date("2026-08-17T09:59:00+09:00")
      ? ["unlock"]
      : ["tempUnlock"],
  ], // BEMANI納涼祭2026 (2026-06-18 10:00~2026-08-17 09:59)
]);

/** Mapping from 3icecream's `version_num` to DDR folder name */
const titleList: Map<SanbaiSong["version_num"], Song["folder"]> = new Map([
  [1, "DanceDanceRevolution 1st Mix"],
  [2, "DanceDanceRevolution 2nd Mix"],
  [3, "DanceDanceRevolution 3rd Mix"],
  [4, "DanceDanceRevolution 4th Mix"],
  [5, "DanceDanceRevolution 5th Mix"],
  [6, "DDRMAX -DanceDanceRevolution 6thMIX-"],
  [7, "DDRMAX2 -DanceDanceRevolution 7thMIX-"],
  [8, "DanceDanceRevolution EXTREME"],
  [9, "DanceDanceRevolution SuperNOVA"],
  [10, "DanceDanceRevolution SuperNOVA2"],
  [11, "DanceDanceRevolution X"],
  [12, "DanceDanceRevolution X2"],
  [13, "DanceDanceRevolution X3 vs 2nd MIX"],
  [14, "DanceDanceRevolution (2013)"],
  [15, "DanceDanceRevolution (2014)"],
  [16, "DanceDanceRevolution A"],
  [17, "DanceDanceRevolution A20"],
  [18, "DanceDanceRevolution A20 PLUS"],
  [19, "DanceDanceRevolution A3"],
  [20, "DanceDanceRevolution World"],
]);

/**
 * Correction data with effective time for future corrections (e.g. unlocks)
 * - [0] Effective time
 * - [1] Song ID
 * - [2] Partial song data to apply after effective time
 */
const timedCorrections: [Date, string, Partial<SanbaiSong>][] = [
  // グランプリ譜面パック vol.2
  ...[
    "Q96bO9D61lib19IiIi0i69P80bo6q69Q", // 321STARS
    "0DDo1ilPDQoIoPd8ol9OPO1IPbi9ii6d", // AA
    "dq190Il9iO1bD698ll6ddObIlqdIQ1O9", // AM-3P
    "P8P1dlqi9D111iIDPOP0l9DIO1l6lqO9", // BABY BABY GIMME YOUR LOVE
    "Q0OiPQQ8IbIDq08IO9Io0qDdoDPPdd1q", // DROP OUT
    "iOPbIi1b99819b9QiD8QbdPbq0DqO0DO", // exotic ethnic
    "8Il6980di8P89lil1PDIqqIbiq1QO8lQ", // MAKE IT BETTER
    "80bQi8IQ8o1iidqd6oQiDPQoPi909olq", // Silent Hill
    "bi1Obd9i99P0O9PqQ1l1P6P6o1IOi11P", // Silver Platform - I wanna get your heart -
    "POoldOddQl9Dbq8b6iOP0iPoQd6IdOPl", // 男々道
  ].map<(typeof timedCorrections)[number]>((id) => [
    new Date("2026-07-31T15:00:00+09:00"),
    id,
    { lock_types: [0, 0, 0, 0, 1000, 0, 0, 0, 1000] },
  ]),
  // BEMANI×東方Project ～幻想郷音樂祭2024～
  ...[
    "16Qb0Oib60oQ1Oql8P806dDd8D0boDi1", // 残像ニ繋ガレタ追憶ノHIDEAWAY
    "lDIO66Dqili0bD0Qo00iIlO6b100i8i0", // 弾幕信仰
    "d1bdqOI8IPIO8i00Plq09d189lIbIo0I", // SUPER HEROINE!!
  ].map<(typeof timedCorrections)[number]>((id) => [
    new Date("2026-08-06T15:00:00+09:00"),
    id,
    { lock_types: [1000, 1000, 1000, 1000, 0, 1000, 1000, 1000, 0] },
  ]),
  // グランプリ譜面パック vol.3
  ...[
    "PP9QDQ0IQQID00P61d8qdDdP09b19iiI", // Blind Justice ～Torn souls, Hurt Faiths～
    "ii6Oooool0IoOqi1qdDo96QIil6IoOq0", // BURNIN' THE FLOOR
    "1diQi81loIodIdOlQ8Pd6Qd8b69Q1DP8", // Destiny lovers
    "1PQdDiqOD6o1b61iiDOoiiblIQbI91Pb", // JET WORLD
    "qIP6DPdbD9iO86i1DO9qDd8l6dPdbl0P", // LOVE♥SHINE
    "i11d86DOOdOb8Pbb1QqIilQI9Idib8PP", // Music In The Rhythm
    "60QoP9DoIo90D616989Q0D0iodOoOd91", // SEXY PLANET
    "lO68Q0iPIOiOIDDd8dOPoiql9OI81DQ0", // The Least 100sec
    "9lob1d1QPd9qiPlQOQ6l0dbodOoDPq1d", // think ya better D
    "qQ9Oo611P0dObD8q6O0Q968bbl8I91OO", // TRIP MACHINE～luv mix～
  ].map<(typeof timedCorrections)[number]>((id) => [
    new Date("2026-08-31T15:00:00+09:00"),
    id,
    { lock_types: [0, 0, 0, 0, 1000, 0, 0, 0, 1000] },
  ]),
  // グランプリ譜面パック vol.4
  ...[
    "Qo9P1oOoDQIoOb8Dd0PdOdoD1D1Pbd8D", // AFTER THE GAME OF LOVE
    "bqQ1OQDidQD8QbIqql06O6o1QD6oOodP", // BRE∀K DOWN！
    "OPbqldiq0dQIo1011086IOl1qbOloOl9", // CANDY☆
    "8liDbidQoI6Q01lO9iibIdboIiDl66Qo", // e-motion
    "olQQ8QPPqqObDD9ooodOl9i9od8b06I9", // Healing Vision ～Angelic mix～
    "8l808Do60DP0qDbD066QQqP1qOQdob90", // HYSTERIA
    "D1D88PPI0PDQqOq00OI6QI1o6dPolqlI", // Tomorrow Perfume
    "bDDd08iP8dlIlOo6iqd91dPiI1lQdOQq", // xenon
    "OboID1PloIIoOOObQdQOP110I61Ddl9I", // 蒼い衝動 ～for EXTREME～
    "qiDOD0iidOli9l0qbP6IbOD19OQ8D8Po", // 月光蝶
  ].map<(typeof timedCorrections)[number]>((id) => [
    new Date("2026-09-30T15:00:00+09:00"),
    id,
    { lock_types: [0, 0, 0, 0, 1000, 0, 0, 0, 1000] },
  ]),
];
/** Correction map for invalid data on 3icecream site */
const invalidDataOnSanbai = new Map<string, Partial<SanbaiSong>>([
  [
    "9OP0iqDD8PDIb8lblD0ol09oP1I1d9PO", // Happy
    { ratings: [3, 5, 8, 12, 0, 6, 8, 13, 0] },
  ],
  ...timedCorrections
    .filter(([time]) => _currentDate >= time)
    .map(([, id, data]) => [id, data] as const),
]);

type SanbaiSongData = Pick<
  Song,
  | "name"
  | "name_translation"
  | "folder"
  | "charts"
  | "flags"
  | "saHash"
  | "search_hint"
> & { deleted: boolean; getJacketUrl: () => string };

export class SanbaiSongImporter implements DDRSongImporter<SanbaiSongData> {
  /** Flags to preserve */
  readonly #unmanagedFlags: string[];
  /**
   * @param unmanagedFlags Flags to preserve
   */
  constructor(unmanagedFlags: string[] = []) {
    this.#unmanagedFlags = unmanagedFlags;
  }

  /**
   * Fetches and converts song data from 3icecream (ALL_SONG_DATA)
   * Applies corrections and returns array for merging
   */
  async fetchSongs(): Promise<SanbaiSongData[]> {
    await this.updateSongDataFile();
    // @ts-ignore: This file is dynamic import
    const { ALL_SONG_DATA } = (await import("./sanbai/songdata.mjs")) as {
      ALL_SONG_DATA: SanbaiSong[];
    };

    const songs: SanbaiSongData[] = [];
    for (const song of ALL_SONG_DATA) {
      // Fix invalid data
      const actual = invalidDataOnSanbai.get(song.song_id);
      if (actual) {
        for (const [key, value] of Object.entries(actual)) {
          const typedKey = key as keyof SanbaiSong;
          const currentValue = song[typedKey];

          if (!Array.isArray(value) && value !== currentValue) {
            console.log(
              `Fixing invalid ${key} for ${song.song_name} on 3ice : ${currentValue} -> ${value}`,
            );
            (song as Record<string, unknown>)[typedKey] = value;
          } else if (
            (Array.isArray(value) &&
              Array.isArray(currentValue) &&
              (value.length !== currentValue.length ||
                value.some((v, i) => v !== currentValue[i]))) ||
            (!Array.isArray(currentValue) && value !== currentValue)
          ) {
            console.log(
              `Fixing invalid ${key} for ${song.song_name} on 3ice : ${currentValue} -> ${value}`,
            );
            (song as Record<string, unknown>)[typedKey] = value;
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

      const songLock =
        song.lock_types?.reduce((prev, curr, i) =>
          prev === curr || !song.ratings[i] ? prev : -1,
        ) ?? 0;

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
        .map((lvl, i) => {
          const chart: Chart = { ...ratingsToStyleAndDiff[i], lvl };
          if (songLock < 0 && song.lock_types?.[i]) {
            chart.flags = lockFlags.get(song.lock_types[i]);
          }
          if (song.tiers[i] && song.tiers[i] !== 1) {
            chart.sanbaiTier = chart.lvl + song.tiers[i];
          }
          return chart;
        })
        .filter((c) => !!c.lvl);

      // Push converted song object (include deleted property)
      songs.push({
        name: song.song_name,
        name_translation: song.romanized_name,
        saHash: song.song_id,
        folder: titleList.get(song.version_num),
        charts,
        flags: lockFlags.get(songLock),
        search_hint:
          [song.searchable_name, song.alternate_name]
            .filter(Boolean)
            .join(" ") || undefined,
        deleted: !!song.deleted || false,
        getJacketUrl: () =>
          `https://3icecream.com/img/banners/${song.song_id}.jpg`,
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
  async updateSongDataFile(): Promise<string | null> {
    const url = "https://3icecream.com/js/songdata.js";
    const jsText = await requestQueue.add(async () => {
      const resp = await fetch(url);
      return await resp.text();
    });
    if (!jsText) return null;

    const mjsText = jsText
      .replace(/\b(const|var)\b/g, "export const")
      .replace(/\u00a0/g, " "); // Replace non-breaking spaces
    const folderPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "sanbai",
    );
    const filePath = path.join(folderPath, "songdata.mjs");
    const { code } = await format(filePath, mjsText);
    if (!(await exists(folderPath))) await mkdir(folderPath);
    await writeFile(filePath, code);
    return filePath;
  }

  /**
   * Compares two song objects for equality
   * @returns {boolean} True if songs are considered equal (same saHash)
   */
  songEquals(existingSong: Song, fetchedSong: SanbaiSongData): boolean {
    return existingSong.saHash === fetchedSong.saHash;
  }

  /**
   * Merges data from an `fetchedSong` into `existingSong` object.
   * @summary This function with side effects that change `existingSong` object
   * @param existingSong Existing song object to update
   * @param fetchedSong Song data from 3icecream
   * @returns True if the merge resulted in any updates
   */
  merge(existingSong: Song, fetchedSong: SanbaiSongData): boolean {
    let hasUpdates = false;

    // update charts
    for (const chart of fetchedSong.charts) {
      const existingChart = existingSong.charts.find(
        (c) => c.style === chart.style && c.diffClass === chart.diffClass,
      );

      if (!existingChart) {
        console.log(
          `Added "${existingSong.name}": [${chart.style}/${chart.diffClass}] (Lv.${chart.lvl})`,
        );
        existingSong.charts.push(chart);
        hasUpdates = true;
        continue;
      }

      // Update level if different
      if (existingChart.lvl !== chart.lvl) {
        console.log(
          `Updated "${existingSong.name}" [${chart.style}/${chart.diffClass}] level: ${existingChart.lvl} -> ${chart.lvl}`,
        );
        existingChart.lvl = chart.lvl;
        hasUpdates = true;
      }
      // Update sanbaiTier if different
      if (chart.sanbaiTier && chart.sanbaiTier !== existingChart.sanbaiTier) {
        console.log(
          `Updated "${existingSong.name}" [${chart.style}/${chart.diffClass}] sanbaiTier: ${existingChart.sanbaiTier} -> ${chart.sanbaiTier}`,
        );
        existingChart.sanbaiTier = chart.sanbaiTier;
        hasUpdates = true;
      }

      // Update chart flags (except unmanaged)
      const managedFlags = (existingChart.flags ?? []).filter(
        (f) => !this.#unmanagedFlags.includes(f),
      );
      const chartFlags = chart.flags ?? [];
      if (
        managedFlags.length !== chartFlags.length ||
        managedFlags.some((f, i) => f !== chartFlags[i])
      ) {
        const flags = [
          ...(existingChart.flags?.filter((f) =>
            this.#unmanagedFlags.includes(f),
          ) ?? []),
          ...(chart.flags ?? []),
        ];
        console.log(
          `Updated "${existingSong.name}" [${chart.style}/${chart.diffClass}] flags: ${existingChart.flags} -> ${flags}`,
        );
        existingChart.flags = flags;
        hasUpdates = true;
      }
      if (!existingChart.flags?.length) {
        delete existingChart.flags;
      }
    }

    // Update song flags (except unmanaged)
    const managedFlags = (existingSong.flags ?? []).filter(
      (f) => !this.#unmanagedFlags.includes(f),
    );
    const fetchedFlags = fetchedSong.flags ?? [];
    if (
      managedFlags.length !== fetchedFlags.length ||
      managedFlags.some((f, i) => f !== fetchedFlags[i])
    ) {
      console.log(
        `Updated flags [${existingSong.flags}] from ${existingSong.name}`,
      );
      const flags = [
        ...(existingSong.flags?.filter((f) =>
          this.#unmanagedFlags.includes(f),
        ) ?? []),
        ...fetchedFlags,
      ];
      console.log(
        `Updated "${existingSong.name}" flags: ${existingSong.flags} -> ${flags}`,
      );
      existingSong.flags = flags;
      hasUpdates = true;
    }
    if (!existingSong.flags?.length) {
      delete existingSong.flags;
    }

    if (!existingSong.folder && fetchedSong.folder) {
      console.log(
        `Updated "${existingSong.name}" folder: ${existingSong.folder} -> ${fetchedSong.folder}`,
      );
      existingSong.folder = fetchedSong.folder;
      hasUpdates = true;
    }

    // Try to get jacket from 3icecream
    if (!existingSong.jacket) {
      const jacket = downloadJacket(
        fetchedSong.getJacketUrl(),
        fetchedSong.name,
      );
      if (jacket) {
        existingSong.jacket = jacket;
        console.log(`Added "${existingSong.name}" jacket: ${jacket}`);
        hasUpdates = true;
      }
    }

    return hasUpdates;
  }
}

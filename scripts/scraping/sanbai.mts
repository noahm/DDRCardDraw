import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { format } from "prettier";

import { downloadJacket, requestQueue } from "../utils.mts";
import type { Chart, Song } from "../../src/models/SongData.ts";
import type { DDRSongImporter } from "./ddr-sources.mts";

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

/** Mapping from 3icecream's `lock_types` to DDRCardDraw's `flags` */
const lockFlags: Map<number, Song["flags"]> = new Map([
  [20, ["goldExclusive", "tempUnlock"]], // BEMANI PRO LEAGUE -SEASON 4- Triple Tribe
  [190, ["grandPrixPack"]], // DDR GRAND PRIX packs
  [240, ["tempUnlock"]], // BEMANI PRO LEAGUE -SEASON 5- Triple Tribe 0 (2025-07-17 10:00~2025-08-31 23:59)
  [250, ["flareRank"]], // FLARE SKILL unlock
  [260, ["tempUnlock"]], // MYSTICAL Re:UNION
  [270, ["worldLeague"]], // WORLD LEAGUE
  [280, ["unlock"]], // EXTRA SAVIOR WORLD
  [290, ["unlock"]], // GALAXY BRAVE
  [300, ["platinumMembers"]], // DDR PLATINUM MEMBERS
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

/** Correction map for invalid data on 3icecream site */
const invalidDataOnSanbai = new Map<string, Partial<SanbaiSong>>([
  ["IObPQb9QlP0iIiboObPoPqIqDo0O11Qi", { deleted: 1 }], // 春を告げる
  // #region グランプリ譜面パックvol.5
  [
    "iIP09bOq1l1b9b1l011IDIQ6Iill90Io", // BROKEN MY HEART
    {
      ratings: [3, 5, 7, 12, 14, 5, 9, 12, 15],
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  [
    "iQo0QOoI6bOPQlbb9ldOo9lbdD1idiOO", // D2R
    {
      ratings: [3, 4, 7, 11, 15, 4, 8, 11, 15],
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  [
    "PD9lP16dllbPqbdIO0Ii0I8D1I90QIIl", // Dragon Blade
    {
      ratings: [5, 9, 10, 11, 18, 9, 11, 11, 17],
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  [
    "i6Q00D16PbbQPl19oibiiQ6qQD01D6o8", // Funk Boogie
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  [
    "69qoD0l6olQqqbl09b069q898b600I6o", // Gamelan de Couple
    {
      ratings: [3, 4, 7, 12, 16, 5, 7, 13, 16],
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  [
    "901q61iP6lPiDqIQoQod9PDqlOPq1bb9", // La Señorita
    {
      ratings: [4, 7, 8, 10, 14, 5, 9, 13, 16],
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  [
    "81qibDQqq8idiD1lQqq0qdqD6i6q1QDb", // No.13
    {
      ratings: [4, 5, 9, 13, 17, 5, 9, 12, 17],
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  [
    "D01oOb0IOQ1bbIIdi88O0d80Qo9dblqP", // Quick Master
    {
      ratings: [4, 5, 8, 11, 15, 5, 7, 10, 15],
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  [
    "01808Q1Q6lQQ1lP0qd80I0b0qqDd1OOP", // WILD RUSH
    {
      ratings: [5, 6, 7, 10, 14, 5, 9, 11, 15],
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  [
    "ql1Q8P100IIlbl0Pdi08I8qD900idqQq", // カゲロウ
    {
      ratings: [3, 4, 7, 9, 14, 4, 7, 9, 14],
      lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190],
    },
  ],
  // #endregion グランプリ譜面パックvol.5
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
            !Array.isArray(currentValue)
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
    const filePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "sanbai",
      "songdata.mjs",
    );
    const formatted = await format(mjsText, { filepath: filePath });
    if (!existsSync("./sanbai/")) await mkdir("./sanbai/");
    await writeFile(filePath, formatted);
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

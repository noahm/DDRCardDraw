import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

import { downloadJacket, exists, requestQueue } from "../utils.mts";
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
  [190, ["grandPrixPack"]], // DDR GRAND PRIX packs
  [240, ["tempUnlock"]], // BEMANI PRO LEAGUE -SEASON 5- Triple Tribe 0 (2025-07-17 10:00~2025-08-31 23:59)
  [250, ["flareRank"]], // FLARE SKILL unlock
  [270, ["worldLeague"]], // WORLD LEAGUE
  [280, ["unlock"]], // EXTRA SAVIOR WORLD
  [290, ["unlock"]], // GALAXY BRAVE
  [300, ["platinumMembers"]], // DDR PLATINUM MEMBERS
  [
    310,
    new Date() < new Date("2026-03-22T23:59:00+09:00")
      ? ["unlock"]
      : ["tempUnlock"],
  ], // BEMANI PRO LEAGUE -SEASON 5- Triple Tribe (2026-01-29 10:00~2026-03-22 23:59)
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
  // #region グランプリ譜面パック vol.6
  [
    "O8qii6oiooPd8lbPqDo9QQioIoQQOoq0", // INSIDE YOUR HEART
    { lock_types: [0, 0, 0, 0, 190, 0, 0, 0, 190] },
  ],
  // #endregion グランプリ譜面パック vol.6
  // #region PRE PRIVILEGE to playable default (about 1 year after release)
  ...(new Date() >= new Date("2026-02-27T15:00:00+09:00")
    ? [
        // スペシャル楽曲パック feat.ひなビタ♪ vol.3
        "6DibIbiiDlq1OiI6QOlPlO1loQOiDb1q", // カタルシスの月
        "I1i6li9l091l6ooqPlP91OlODPbqqo9P", // ムラサキグルマ
        "9O8bq8b1Pi6Dl08OiPq10OddOdol1qOi", // ロンロンへ ライライライ！
        // スペシャル楽曲パック feat.REFLEC BEAT vol.3
        "0Ilqbl8q8Q6l6886Q9P9DOi69oIb1b1d", // Gale Rider
        "qdbod6lI0I8O118DPq80D8b0o00OodlI", // Hollywood Galaxy
      ].map<[string, Partial<SanbaiSong>]>((id) => [
        id,
        { lock_types: undefined },
      ])
    : []),
  ...(new Date() >= new Date("2026-03-31T15:00:00+09:00")
    ? [
        // BEMANI SELECTION楽曲パックvol.3
        "olIo8PdO8dq16QqDIQboQq6oPqDO9qoo", // Get Back Up!
        "I9Oood9l9li0D08Q6d6DQPiIQiloidO6", // Riot of Color
        "I1I0qd19DqIoI0qdqd6oPO68O8DDi6OI", // 勇猛無比
        // グランプリ楽曲パックvol.35
        "86q90PPqld0qili801IqDOD0Q6boblI1", // Couleur=Blanche
        "Di0ODIlddo8d90oo09qqd98QObQP1llI", // [ ]DENTITY
        "b1QllqO8oQdqo086QdIlIblDDbPodDoP", // Lose Your Sense
      ].map<[string, Partial<SanbaiSong>]>((id) => [
        id,
        { lock_types: undefined },
      ])
    : []),
  // #endregion PRE PRIVILEGE to playable default (about 1 year after release)
  // #region EXTRA SAVIOR WORLD - The 1st GITADORA
  ["dI0q9QdPOI1lq6888qI980dqll6dbqib", { song_name: "羽根亡キ少女唄" }],
  // #endregion EXTRA SAVIOR WORLD - The 1st GITADORA
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
    const folderPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "sanbai",
    );
    const filePath = path.join(folderPath, "songdata.mjs");
    const formatted = await format(mjsText, { filepath: filePath });
    if (!(await exists(folderPath))) await mkdir(folderPath);
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

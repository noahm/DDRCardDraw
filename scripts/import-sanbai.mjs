import {
  guessUrlFromName,
  getJacketFromRemySong,
  getMetaFromRemy,
} from "./scraping/remy.mjs";
import { DDR_WORLD as MIX_META } from "./scraping/ddr-sources.mjs";
import * as path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import {
  writeJsonData,
  requestQueue,
  reportQueueStatusLive,
  checkJacketExists,
  sortSongs,
  setJacketPrefix,
} from "./utils.mjs";

const idxMap = [
  "single:beginner",
  "single:basic",
  "single:difficult",
  "single:expert",
  "single:challenge",
  "double:basic",
  "double:difficult",
  "double:expert",
  "double:challenge",
];

setJacketPrefix(MIX_META.jacketPrefix);

/**
 * Invalid data on 3icecream site
 * @typedef {typeof import('./scraping/songdata.mjs').ALL_SONG_DATA[number]} SongData
 * @type {Map<SongData['song_id'], Partial<SongData>>}
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
    "99I10l8o6DPI886l9818ID16OlqI8oId", // ミックスナッツ
    { deleted: true },
  ],
]);

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

const manualyAddFlags = new Set(["copyStrikes"]);

/**
 *
 * @param {string} diffClass
 * @param {string} style
 * @returns
 */
function diffIdxFor(diffClass, style) {
  return idxMap.indexOf(`${style}:${diffClass}`);
}

/**
 *
 * @param {number} idx
 * @returns {[style: string, diffClass: string]}
 */
function styleAndDiffFor(idx) {
  const ret = idxMap[idx].split(":");
  return [ret[0], ret[1]];
}

/**
 *
 * @param {string} id
 * @param {string} diffClass
 * @param {string} style
 * @returns
 */
function chartKeyFor(id, diffClass, style) {
  return `${id}/${diffIdxFor(diffClass, style)}`;
}
import {
  ALL_SONG_DATA as sanbaiData,
  SONG_DATA_LAST_UPDATED_unixms,
} from "./scraping/songdata.mjs";

const ui = reportQueueStatusLive();
let warnings = 0;
try {
  const targetFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/songs",
    MIX_META.filename,
  );

  /**
   * @type {import('../src/models/SongData.js').GameData}
   */
  const existingData = JSON.parse(
    await readFile(targetFile, { encoding: "utf-8" }),
  );

  const foldersByIndex = existingData.meta.folders.slice();
  foldersByIndex.reverse();
  foldersByIndex.unshift("zero");

  // const log = (...msgs) =>
  //   ui.log.write(msgs.map((item) => item.toString()).join(" "));

  ///** @type {Record<string, ReturnType<typeof getDifficultyList>>} */
  // const ratingsLists = {};

  // /**
  //  * @param {number} difficulty
  //  * @param {string} style
  //  */
  // function getCachedDifficultyList(difficulty, style) {
  //   const key = `${style}:${difficulty}`;
  //   if (!ratingsLists[key]) {
  //     ratingsLists[key] = requestQueue.add(
  //       () => getDifficultyList(difficulty, style),
  //       {
  //         throwOnTimeout: true,
  //       },
  //     );
  //   }
  //   return ratingsLists[key];
  // }

  // let warnings = 0;
  // const ui = reportQueueStatusLive();
  // for (const song of existingData.songs) {
  //   for (const chart of song.charts) {
  //     getCachedDifficultyList(chart.lvl, chart.style).then(
  //       (difficultyRatings) => {
  //         const chartKey = chartKeyFor(song.saHash, chart.diffClass, chart.style);
  //         const maybeRating = difficultyRatings[chartKey];
  //         if (!maybeRating) {
  //           ui.log.write(`No tier for ${song.name} - ${chartKey}`);
  //           warnings++;
  //         } else {
  //           chart.sanbaiTier = chart.lvl + maybeRating.tier;
  //         }
  //       },
  //     );
  //   }
  // }
  const tasks = sanbaiData.map(async (song) => {
    // Fix invalid data
    if (invalidDataOnSanbai.has(song.song_id)) {
      const actual = invalidDataOnSanbai.get(song.song_id);
      for (const [key, value] of Object.entries(actual)) {
        if (!Array.isArray(value) && value !== song[key]) {
          ui.log.write(
            `Fixing invalid ${key} of ${song.song_name} on 3ice : ${song[key]} -> ${value}`,
          );
          song[key] = value;
        } else if (
          Array.isArray(value) &&
          (value.length !== song[key]?.length ||
            value.some((v, i) => v !== song[key][i]))
        ) {
          ui.log.write(
            `Fixing invalid ${key} of ${song.song_name} on 3ice : ${song[key]} -> ${value}`,
          );
          song[key] = value;
          if (key === "ratings") {
            song.tiers = song.tiers.map((_) => 1); // reset tiers
          }
        } else {
          ui.log.write(
            `invalidDataOnSanbai has ${song.song_name}.${key}, but no change needed`,
          );
        }
      }
    }

    const existingSong = existingData.songs.find(
      (s) => s.saHash === song.song_id || s.name === song.song_name,
    );

    // Delete songs that are removed from the game
    if (song.deleted) {
      if (existingSong) {
        ui.log.write(`Deleting removed song: ${existingSong.name}`);
        existingData.songs = existingData.songs.filter(
          (s) => s !== existingSong,
        );
      }
      return;
    }

    const locks = song.lock_types;
    /** @type {number|null} */
    let songLock = null;
    if (locks) {
      const allChartsLocked = song.ratings.every(
        (lvl, idx) => !lvl || locks[idx],
      );
      if (allChartsLocked) {
        songLock = locks[0];
      }
    }

    const charts = song.ratings
      .map((lvl, idx) => {
        const [style, diffClass] = styleAndDiffFor(idx);
        /** @type {import('../src/models/SongData.js').Chart} */
        const chart = {
          lvl,
          style,
          diffClass,
        };
        if (locks && locks[idx] && locks[idx] !== songLock) {
          chart.flags = lockFlags[locks[idx]];
        }
        if (song.tiers[idx] && song.tiers[idx] !== 1) {
          chart.sanbaiTier = chart.lvl + song.tiers[idx];
        }
        return chart;
      })
      .filter((c) => !!c.lvl);

    if (existingSong) {
      // add missing id
      if (!existingSong.saHash) {
        existingSong.saHash = song.song_id;
      }
      // update charts/flags
      for (const freshChartData of charts) {
        const existingChart = existingSong.charts.find(
          (existingChart) =>
            existingChart.diffClass === freshChartData.diffClass &&
            existingChart.style === freshChartData.style,
        );
        if (!existingChart) {
          ui.log.write(
            `Adding missing ${freshChartData.diffClass} chart of ${song.song_name}`,
          );
          existingSong.charts.push(freshChartData);
          continue;
        }

        const givenTier =
          song.tiers[diffIdxFor(existingChart.diffClass, existingChart.style)];
        if (givenTier && givenTier !== 1) {
          existingChart.sanbaiTier = freshChartData.lvl + givenTier;
        }
        if (existingChart.lvl !== freshChartData.lvl) {
          ui.log.write(
            `Updating lvl of ${song.song_name} ${freshChartData.diffClass}`,
          );
          existingChart.lvl = freshChartData.lvl;
        }

        // Update chart flags
        const meaningfulChartFlags = (existingChart.flags ?? []).filter(
          (f) => !manualyAddFlags.has(f),
        );
        freshChartData.flags = [
          ...(existingChart.shock ? ["shock"] : []),
          ...(freshChartData.flags ?? []),
        ];
        if (
          meaningfulChartFlags.length !== freshChartData.flags.length ||
          meaningfulChartFlags.some((f, i) => f !== freshChartData.flags[i])
        ) {
          ui.log.write(
            `Updating flags of ${song.song_name} ${freshChartData.diffClass}`,
          );
          existingChart.flags = [
            ...(existingChart.flags?.filter((f) => manualyAddFlags.has(f)) ??
              []),
            ...(freshChartData.flags ?? []),
          ];
          if (!existingChart.flags.length) {
            delete existingChart.flags;
          }
        }
      }
      // Update song flags
      const meaningfulSongFlags = (existingSong.flags ?? []).filter(
        (f) => !manualyAddFlags.has(f),
      );
      if (
        meaningfulSongFlags.length !== (lockFlags[songLock]?.length ?? 0) ||
        meaningfulSongFlags.some((f, i) => f !== lockFlags[songLock][i])
      ) {
        ui.log.write(
          `Updating flags [${existingSong.flags}] from ${existingSong.name}`,
        );
        existingSong.flags = [
          ...(existingSong.flags?.filter((f) => manualyAddFlags.has(f)) ?? []),
          ...(lockFlags[songLock] ?? []),
        ];
        if (!existingSong.flags.length) {
          delete existingSong.flags;
        }
      }

      if (!existingSong.remyLink) {
        const remyLink = await guessUrlFromName(song.song_name);
        ui.log.write("guessed url as " + (remyLink || "null"));
        existingSong.remyLink = remyLink || null;
      }
      if (!existingSong.jacket) {
        if (existingSong.remyLink) {
          ui.log.write(
            `missing jacket for ${existingSong.name}, fetching from remy`,
          );
          existingSong.jacket = await getJacketFromRemySong(
            existingSong.remyLink,
            existingSong.name,
          );
          ui.log.write(`updated jacket property to ${existingSong.jacket}`);
        } else {
          ui.log.write(
            `no remy link for ${existingSong.name}, so will remain without image`,
          );
        }
      }
      if (existingSong.artist === "???" || existingSong.bpm === "???") {
        if (!existingSong.remyLink) {
          ui.log.write(
            `missing remy link for ${existingSong.name} so can't add bpm or artist data`,
          );
        }
        const meta = await getMetaFromRemy(existingSong.remyLink);
        existingSong.artist = meta.artist || "???";
        existingSong.bpm = meta.bpm || "???";
      }
    } else {
      // insert new song (need to find jacket, bpm, folder, etc)
      ui.log.write(`Adding new song: ${song.song_name}`);
      const remyLink = await guessUrlFromName(song.song_name);
      ui.log.write("guessed url as " + (remyLink || "null"));
      let jacket = checkJacketExists(song.song_name);
      if (remyLink && !jacket) {
        jacket = await getJacketFromRemySong(remyLink, song.song_name);
      }
      const meta = remyLink
        ? await getMetaFromRemy(remyLink)
        : { artist: null, bpm: null };
      existingData.songs.push({
        name: song.song_name,
        name_translation: song.romanized_name,
        artist: meta.artist || "???",
        folder: foldersByIndex[song.version_num],
        bpm: meta.bpm || "???",
        charts,
        flags:
          songLock && lockFlags[songLock] ? lockFlags[songLock] : undefined,
        jacket,
        remyLink: remyLink ? remyLink : undefined,
        saHash: song.song_id,
        search_hint:
          [song.searchable_name, song.alternate_name]
            .filter(Boolean)
            .join(" ") || undefined,
      });
    }
  });

  await Promise.all(tasks);
  await requestQueue.onIdle();
  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });

  existingData.songs = sortSongs(existingData.songs);

  await writeJsonData(existingData, targetFile, SONG_DATA_LAST_UPDATED_unixms);
  if (warnings) {
    ui.log.write(`Done, with ${warnings} warnings`);
  } else {
    ui.log.write("Done");
  }
  ui.close();
} catch (e) {
  ui.close();
  console.error(e);
  process.exitCode = 1;
}

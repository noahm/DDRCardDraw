import { getDifficultyList, getSanbaiData } from "./scraping/sanbai.mjs";
import { guessUrlFromName, getJacketFromRemySong } from "./scraping/remy.mjs";
import {
  getSongsFromSkillAttack,
  indexSaData,
} from "./scraping/skill-attack.mjs";
import { DDR_A3 as MIX_META } from "./scraping/ddr-sources.mjs";
import * as path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import {
  writeJsonData,
  requestQueue,
  reportQueueStatusLive,
  checkJacketExists,
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
  return idxMap[idx].split(":");
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

let warnings = 0;
const ui = reportQueueStatusLive();
const log = (...msgs) =>
  ui.log.write(msgs.map((item) => item.toString()).join(" "));

const saData = await getSongsFromSkillAttack(log);
const indexedSaData = indexSaData(saData);

/** @type {Record<string, ReturnType<typeof getDifficultyList>>} */
const ratingsLists = {};

/**
 * @param {number} difficulty
 * @param {string} style
 */
function getCachedDifficultyList(difficulty, style) {
  const key = `${style}:${difficulty}`;
  if (!ratingsLists[key]) {
    ratingsLists[key] = requestQueue.add(
      () => getDifficultyList(difficulty, style),
      {
        throwOnTimeout: true,
      },
    );
  }
  return ratingsLists[key];
}

const lockFlags = {
  10: null, //"a20+usLocked"
  20: "goldenLeague",
  60: null, //"a20+kacRegistration",
  80: null, // a20 unlock
  130: null, // a20 unlock
  150: null, //"a20+extraexclusive",
  160: null, //"a20+courseUnlock",
  180: "unlock",
  190: "grandPrixPack",
  210: "tempUnlock",
  220: "tempUnlock", // kacRegistration
  230: "babylonGalaxy", // babylonGalaxy
  240: "bpl3", // bpl3
};

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
import { ALL_SONG_DATA } from "./scraping/songdata.mjs";
for (const song of ALL_SONG_DATA) {
  const deleted = song.deleted;
  const existingSong = existingData.songs.find(
    (s) => s.saHash === song.song_id,
  );
  if (deleted) {
    if (existingSong) {
      ui.log.write(`Deleting removed song: ${existingSong.name}`);
      existingData.songs = existingData.songs.filter((s) => s !== existingSong);
    }
    continue;
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
        chart.flags = [lockFlags[locks[idx]]];
        // TODO add shock flags as appropriate
      }
      return chart;
    })
    .filter((c) => !!c.lvl);

  if (existingSong) {
    // update charts/flags
    for (const freshChartData of charts) {
      const existingChart = existingSong.charts.find(
        (existingChart) =>
          existingChart.diffClass === freshChartData.diffClass &&
          existingChart.style === freshChartData.style,
      );
      if (!existingChart) {
        if (
          song.version_num !== 19 &&
          freshChartData.diffClass === "challenge"
        ) {
          freshChartData.flags ||= [];
          freshChartData.flags.push("newInA3");
        }
        ui.log.write(
          `Adding missing ${freshChartData.diffClass} chart of ${song.song_name}`,
        );
        existingSong.charts.push(freshChartData);
        continue;
      }
      // if (existingChart.lvl !== freshChartData.lvl) {
      //   ui.log.write(
      //     `Updating lvl of ${song.song_name} ${freshChartData.diffClass}`,
      //   );
      //   existingChart.lvl = freshChartData.lvl;
      // }
      const meaningfulFlags = (existingChart.flags || []).filter(
        (f) => f !== "shock" && f !== "newInA3",
      );
      if (meaningfulFlags.length && !freshChartData.flags) {
        ui.log.write(
          `Removing flags [${meaningfulFlags.join(",")}] of ${song.song_name} ${freshChartData.diffClass}`,
        );
        existingChart.flags = existingChart.flags.filter(
          (f) => f === "shock" || f === "newInA3",
        );
        if (!existingChart.flags.length) {
          delete existingChart.flags;
        }
      }
    }
    if (existingSong.flags && !songLock) {
      ui.log.write(
        `Removing flags [${existingSong.flags.join(",")}] from ${existingSong.name}`,
      );
      delete existingSong.flags;
    }
  } else {
    // insert new song (need to find jacket, bpm, folder, etc)
    ui.log.write(`Adding new song: ${song.song_name}`);
    const saData = indexedSaData[song.song_id];
    const remyLink = await requestQueue.add(() =>
      guessUrlFromName(song.song_name),
    );
    let jacket = checkJacketExists(song.song_name);
    if (remyLink && !jacket) {
      jacket = await getJacketFromRemySong(remyLink, song.song_name);
    }
    existingData.songs.push({
      name: song.song_name,
      saHash: song.song_id,
      artist: saData?.artist,
      folder: foldersByIndex[song.version_num],
      bpm: "???", // TODO
      charts,
      jacket,
      remyLink: remyLink ? remyLink : undefined,
      flags:
        songLock && lockFlags[songLock] ? [lockFlags[songLock]] : undefined,
      name_translation: song.romanized_name,
      search_hint:
        [song.searchable_name, song.alternate_name].filter(Boolean).join(" ") ||
        undefined,
    });
  }
}

await requestQueue.onIdle();
await new Promise((resolve) => {
  setTimeout(resolve, 500);
});
await writeJsonData(existingData, targetFile);
if (warnings) {
  ui.log.write(`Done, with ${warnings} warnings`);
} else {
  ui.log.write("Done");
}
ui.close();

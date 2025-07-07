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

/** Invalid data on 3icecream site */
const invalidDataOnSanbai = new Map([
  [
    // Bloody Tears (IIDX EDITION)
    "oQ0bqIQ8DdPlilO000DQloOo6Od8IdQ6",
    {
      sanbaiLevel: [3, 0, 0, 0, 0, 0, 0, 0, 0],
      actualLevel: [4, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ],
  [
    // Mermaid girl
    "61QQi8i9Iliq66IOq1ib888b666o08O8",
    {
      sanbaiLevel: [0, 0, 0, 0, 0, 6, 0, 0, 0],
      actualLevel: [0, 0, 0, 0, 0, 5, 0, 0, 0],
    },
  ],
]);

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

  const knownRemoved = new Set([]);

  const lockFlags = {
    20: ["goldExclusive", "tempUnlock"], // BEMANI PRO LEAGUE -SEASON 4- Triple Tribe
    190: ["grandPrixPack"], // DDR GRAND PRIX packs
    250: ["flareRank"], // FLARE SKILL unlock
    260: ["tempUnlock"], // MYSTICAL Re:UNION
    270: ["worldLeague"], // WORLD LEAGUE
    280: ["unlock"], // EXTRA SAVIOR WORLD
    290: ["unlock"], // GALAXY BRAVE
    300: ["platinumMembers"], // DDR PLATINUM MEMBERS
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
  const tasks = sanbaiData.map(async (song) => {
    const existingSong = existingData.songs.find(
      (s) => s.saHash === song.song_id || s.name === song.song_name,
    );

    // Delete songs that are removed from the game
    if (song.deleted || knownRemoved.has(song.song_id)) {
      if (existingSong) {
        ui.log.write(`Deleting removed song: ${existingSong.name}`);
        existingData.songs = existingData.songs.filter(
          (s) => s !== existingSong,
        );
      }
      return;
    }

    // Fix invalid data
    if (invalidDataOnSanbai.has(song.song_id)) {
      const actual = invalidDataOnSanbai.get(song.song_id);
      song.ratings = song.ratings.map((lvl, idx) => {
        const actualLevel = actual.actualLevel[idx];
        if (actualLevel && lvl !== actualLevel) {
          ui.log.write(
            `Fixing invalid level for ${song.song_name} (${idxMap[idx]}): ${lvl} -> ${actualLevel}`,
          );
          song.tiers[idx] = 1; // reset tier
          return actualLevel;
        }
        return lvl;
      });
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
          // TODO add shock flags as appropriate
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
        // const meaningfulFlags = (existingChart.flags || []).filter(
        //   (f) => f !== "shock" && f !== "newInA3",
        // );
        // if (meaningfulFlags.length && !freshChartData.flags) {
        //   ui.log.write(
        //     `Removing flags [${meaningfulFlags.join(",")}] of ${song.song_name} ${freshChartData.diffClass}`,
        //   );
        //   existingChart.flags = existingChart.flags.filter(
        //     (f) => f === "shock" || f === "newInA3",
        //   );
        //   if (!existingChart.flags.length) {
        //     delete existingChart.flags;
        //   }
        // }
      }
      // if (existingSong.flags && !songLock) {
      //   ui.log.write(
      //     `Removing flags [${existingSong.flags.join(",")}] from ${existingSong.name}`,
      //   );
      //   delete existingSong.flags;
      // }
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
      const meta = await getMetaFromRemy(remyLink);
      existingData.songs.push({
        name: song.song_name,
        saHash: song.song_id,
        artist: meta.artist || "???",
        folder: foldersByIndex[song.version_num],
        bpm: meta.bpm || "???",
        charts,
        jacket,
        remyLink: remyLink ? remyLink : undefined,
        flags:
          songLock && lockFlags[songLock] ? lockFlags[songLock] : undefined,
        name_translation: song.romanized_name,
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

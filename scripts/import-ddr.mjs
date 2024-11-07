// @ts-check
/**
 * This script pulls song data from ZiV, SkillAttack, and jackets from RemyWiki
 * all while merging with the existing data on disk to get the most up to date
 * song data with the least amount of manual work on my part.
 */

import { readFile } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { DDR_WORLD as MIX_META } from "./scraping/ddr-sources.mjs";
import { getJacketFromRemySong, getRemovedSongUrls } from "./scraping/remy.mjs";
import { getSongsFromSkillAttack } from "./scraping/skill-attack.mjs";
import { getSongsFromZiv } from "./scraping/ziv.mjs";
import {
  reportQueueStatusLive,
  requestQueue,
  writeJsonData,
  setJacketPrefix,
  checkJacketExists,
  sortSongs,
} from "./utils.mjs";

setJacketPrefix(MIX_META.jacketPrefix);

/** returns data to use for given songs */
async function mergeSongs(oldData, zivData, saData, log) {
  if (!oldData) {
    oldData = zivData;
  }

  const data = {
    ...zivData,
    remyLink: oldData.remyLink,
    jacket: oldData.jacket,
    genre: oldData.genre,
    flags: mergeFlags(oldData.flags, zivData.flags),
    search_hint: oldData.search_hint,
  };

  delete data.getRemyLink;
  if (!data.remyLink && MIX_META.fetchJackets) {
    data.remyLink = await zivData.getRemyLink();
  }

  if (saData) {
    data.saHash = saData.saHash;
    data.saIndex = saData.saIndex;
  }
  if (oldData.artist_translation?.length > data.artist_translation?.length) {
    data.artist_translation = oldData.artist_translation;
  }
  if (oldData.bpm.length > data.bpm) {
    data.bpm = oldData.bpm;
  }

  if (!saData && MIX_META.mergeSkillAttack) {
    log("[WARN] missing SA data for:", zivData.name);
  }
  // copy flags and stuff over from previous chart definitions onto sa lvl difficulty data
  data.charts = (saData || data).charts.map((chart) => {
    const oldChart = findMatchingChart(oldData.charts, chart);
    let zivChart = findMatchingChart(zivData.charts, chart);
    if (oldChart) {
      return {
        ...oldChart,
        lvl: chart.lvl,
        flags: zivChart
          ? mergeFlags(oldChart.flags, zivChart.flags)
          : oldChart.flags,
      };
    }
    return chart;
  });
  return data;
}

function findMatchingChart(charts, target) {
  return charts.find(
    (oc) => oc.style === target.style && oc.diffClass === target.diffClass,
  );
}

/**
 *
 * @param {string[]} flagsA
 * @param {string[]} flagsB
 * @returns
 */
function mergeFlags(flagsA = [], flagsB = []) {
  const flags = new Set([...flagsA, ...flagsB]);
  if (!flags.size) {
    return;
  }
  if (flags.has("tempUnlock")) {
    flags.delete("unlock");
  }
  return Array.from(flags);
}

function findSongFromSa(indexedSongs, saIndex, song) {
  if (saIndex[song.saIndex]) {
    return saIndex[song.saIndex];
  }
  let title = song.name;
  const transforms = [
    (s) => s,
    (s) => s.replace("PARANOiA", "PARANOIA"),
    (s) => s.replace("PARANOIA", "PARANOiA"),
    (s) => s.replace(/～(.+)～/, " ($1)"),
    (s) => s.replace(/（(.+)）/, " ($1)"),
    (s) => s.replace(/-(.+)-/, " ($1)"),
    (s) => s.replace(/[^\s]\(/, " ("),
    (s) => s.replace("！", "!"),
    (s) => s.replace("＋", "+"),
    (s) => s.replace("＊", "*"),
    (s) => s.replace("[“”]", '"'),
    (s) => s.replace("･", "・"),
  ];
  for (const transform of transforms) {
    title = transform(title);
    if (indexedSongs[title]) {
      return indexedSongs[title];
    }
  }
}

/** best attempt at reconsiling data from ziv and sa */
async function importSongsFromExternal(indexedSongs, saIndex, log) {
  const [zivSongs, saSongs, removedRemyLinks] = await Promise.all([
    getSongsFromZiv(
      log,
      MIX_META.ziv,
      MIX_META.includeFolders,
      MIX_META.titleOffset,
    ).then((songs) => {
      log(`Found ${songs.length} songs on ZiV`);
      return songs;
    }),
    MIX_META.mergeSkillAttack
      ? getSongsFromSkillAttack(log).then((songs) => {
          log(`Found ${songs.length} songs on SA`);
          return songs;
        })
      : [],
    getRemovedSongUrls(MIX_META.remy)
      .then((delSongs) => {
        log(`Found ${delSongs.size} removed songs from RemyWiki`);
        // if (delSongs.size) {
        //   console.log(delSongs);
        // }
        return delSongs;
      })
      .catch(() => {
        log("Failed to find removed songs on remy");
        return new Set();
      }),
  ]);
  let unmatchedSa = 0;
  for (const saSong of saSongs) {
    const existingSong = findSongFromSa(indexedSongs, saIndex, saSong);
    if (!existingSong) {
      unmatchedSa++;
      log(
        `  Unmatched song from SA: ${saSong.name}\n    index ${saSong.saIndex}\n    hash ${saSong.saHash}`,
      );
    }
  }
  log(`Total of ${unmatchedSa} unmatched SA songs`);
  return Promise.all(
    zivSongs.map(async (promiseOfSong) => {
      const zivSong = await promiseOfSong;
      if (
        MIX_META.excludeTitles &&
        MIX_META.excludeTitles.some((pattern) => zivSong.name.match(pattern))
      ) {
        return;
      }
      const existingSong = indexedSongs[zivSong.name];
      const saSong = saSongs.find((song) => {
        if (existingSong && existingSong.saIndex === song.saIndex) {
          return true;
        }
        if (song.name === zivSong.name) return true;
        return false;
      });
      const song = await mergeSongs(existingSong, zivSong, saSong, log);
      if (removedRemyLinks.has(song.remyLink)) {
        log("Skipping removed song");
        return;
      } else if (!existingSong) {
        log(`  New song from ziv: ${song.name} (${song.remyLink})`);
      }
      if (!song.jacket) {
        delete song.jacket;
        if (MIX_META.fetchJackets) {
          switch (MIX_META.preferredJacketSource) {
            case "remy":
              if (song.remyLink) {
                const remyJacket = await getJacketFromRemySong(
                  song.remyLink,
                  song.name_translation,
                );
                if (remyJacket) {
                  song.jacket = remyJacket;
                  break;
                }
              }
            case "ziv": {
              const zivJacket = await zivSong.getZivJacket();
              if (zivJacket) {
                song.jacket = zivJacket;
              }
            }
          }
        } else {
          const maybeJacket = checkJacketExists(
            song.name_translation || song.name,
          );
          if (maybeJacket) {
            song.jacket = maybeJacket;
          }
        }
      }
      // re-order flags field to be after jacket
      // const flags = song.flags;
      // if (flags) {
      //   delete song.flags;
      //   song.flags = flags;
      // }
      if (existingSong) {
        if (!song.saHash) song.saHash = existingSong.saHash;
        if (!song.saIndex) song.saIndex = existingSong.saIndex;
      }
      indexedSongs[zivSong.name] = song;
    }),
  );
}

async function main() {
  const targetFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/songs",
    MIX_META.filename,
  );
  const existingData = JSON.parse(
    await readFile(targetFile, { encoding: "utf-8" }),
  );
  const prevCount = existingData.songs.length;
  /** index of songs by title */
  const indexedSongs = {};
  const songsBySaIndex = {};
  for (const song of existingData.songs) {
    if (indexedSongs[song.name]) {
      console.warn(`Duplicate song title: ${song.name}`);
    }
    indexedSongs[song.name] = song;
    if (song.saIndex) {
      songsBySaIndex[song.saIndex] = song;
    }
  }

  const ui = reportQueueStatusLive();
  const log = (...msgs) =>
    ui.log.write(msgs.map((item) => item.toString()).join(" "));

  await importSongsFromExternal(indexedSongs, songsBySaIndex, log);

  existingData.songs = sortSongs(Object.values(indexedSongs));

  for (const song of existingData.songs) {
    if (!song.jacket && song.remyLink) {
      const remyJacket = await getJacketFromRemySong(
        song.remyLink,
        song.name_translation,
      );
      if (remyJacket) {
        song.jacket = remyJacket;
      }
    }
  }
  await writeJsonData(existingData, targetFile);

  ui.log.write(
    `Wrote ${existingData.songs.length} (${
      existingData.songs.length - prevCount
    } new) sorted songs to ${path.basename(targetFile)}`,
  );

  if (requestQueue.size) {
    ui.log.write("waiting on remaining images to finish downloading...");
    await requestQueue.onIdle();
  }
  ui.log.write("Done");
  ui.close();
}
main().catch((e) => {
  console.error(e);
});

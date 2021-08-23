const fs = require("fs");
const path = require("path");
const {
  getSongsFromZiv,
  getSongsFromSkillAttack,
} = require("../scraper/a20plus");
const { getJacketFromRemySong } = require("./remy");
const {
  writeJsonData,
  reportQueueStatusLive,
  requestQueue,
} = require("./utils");

/** @param songs {Array<{}>} */
function sortSongs(songs) {
  for (const song of songs) {
    song.charts.sort((chartA, chartB) => {
      if (chartA.style !== chartB.style) {
        // sort singles first, doubles second
        return chartA.style > chartB.style ? -1 : 1;
      }
      // sort by level within style
      return chartA.lvl - chartB.lvl;
    });
  }
  return songs.sort((songA, songB) =>
    songA.name.toLowerCase() > songB.name.toLowerCase() ? 1 : -1
  );
}

/** returns data to use for given songs */
function mergeSongs(oldData, zivData, saData) {
  if (!oldData) {
    return zivData;
  }
  const data = {
    ...zivData,
    jacket: oldData.jacket,
    genre: oldData.genre,
    flags: oldData.flags,
    search_hint: oldData.search_hint,
  };
  if (saData) {
    data.saHash = saData.saHash;
    data.saIndex = saData.saIndex;
  }
  if (oldData.artist_translation.length > data.artist_translation.length) {
    data.artist_translation = oldData.artist_translation;
  }
  if (oldData.bpm.length > data.bpm) {
    data.bpm = oldData.bpm;
  }
  if (!saData) {
    console.error("missing SA data for:", zivData.name);
  }
  // copy flags and stuff over from previous chart definitions onto sa lvl difficulty data
  data.charts = (saData || data).charts.map((chart) => {
    const oldChart = findMatchingChart(oldData.charts, chart);
    let zivChart = findMatchingChart(zivData.charts, chart);
    if (oldChart) {
      return {
        ...oldChart,
        lvl: chart.lvl,
        flags: mergeFlags(oldChart.flags, zivChart.flags),
      };
    }
    return chart;
  });
  return data;
}

function findMatchingChart(charts, target) {
  return charts.find(
    (oc) => oc.style === target.style && oc.diffClass === target.diffClass
  );
}

function mergeFlags(flagsA, flagsB) {
  const flags = [];
  if (flagsA) {
    flags.push(...flagsA);
  }
  if (flagsB) {
    flags.push(...flagsB);
  }
  if (!flags.length) {
    return;
  }
  return Array.from(new Set(flags));
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
async function importSongsFromExternal(indexedSongs, saIndex) {
  const [zivSongs, saSongs] = await Promise.all([
    getSongsFromZiv(),
    getSongsFromSkillAttack(),
  ]);
  console.log(`Found ${zivSongs.length} songs on ZiV`);
  console.log(`Found ${saSongs.length} songs on SA`);
  let unmatchedSa = 0;
  for (const saSong of saSongs) {
    const existingSong = findSongFromSa(indexedSongs, saIndex, saSong);
    if (!existingSong) {
      unmatchedSa++;
      console.log(
        `  Unmatched song from SA: ${saSong.name}\n    index ${saSong.saIndex}\n    hash ${saSong.saHash}`
      );
    }
  }
  console.log(`Total of ${unmatchedSa} unmatched SA songs`);
  for (const zivSong of zivSongs) {
    const existingSong = indexedSongs[zivSong.name];
    if (!existingSong) {
      console.log(`  New song from ziv: ${zivSong.name}`);
    }
    const saSong = saSongs.find((song) => {
      if (existingSong && existingSong.saIndex === song.saIndex) {
        return true;
      }
      if (song.name === zivSong.name) return true;
      return false;
    });
    const song = mergeSongs(existingSong, zivSong, saSong);
    if (!song.jacket && song.remyLink) {
      const remyJacket = await getJacketFromRemySong(
        song.remyLink,
        song.name_translation
      );
      if (remyJacket) {
        song.jacket = remyJacket;
      }
    }
    indexedSongs[zivSong.name] = song;
  }
}

async function main() {
  const targetFile = path.join(__dirname, "../src/songs/a20plus.json");
  const existingData = require(targetFile);
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

  reportQueueStatusLive();
  await importSongsFromExternal(indexedSongs, songsBySaIndex);

  existingData.songs = sortSongs(Object.values(indexedSongs));
  writeJsonData(existingData, targetFile);

  console.log(
    `Wrote ${existingData.songs.length} (${existingData.songs.length -
      prevCount} new) sorted songs to a20plus.json`
  );

  if (requestQueue.size) {
    console.log("waiting on remaining images to finish downloading...");
    await requestQueue.onIdle();
  }
}
main();

/**
 * Script to import SMX data from direct from statmaniax (thanks cube!)
 */

const path = require("path");
const { resolve } = require("path");
const fetch = require("node-fetch");
const {
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
  writeJsonData,
} = require("./utils");

const GET_IMAGES = true;

/**
 * queues a cover path for download,
 * returns the filename that will eventually be used
 */
function queueJacketDownload(coverPath) {
  coverPath = path.join(coverPath, "cover.png");
  const coverStub = coverPath.split("/")[2];
  const outPath = `smx/${coverStub}.jpg`;
  if (GET_IMAGES) {
    downloadJacket(`https://data.stepmaniax.com/${coverPath}`, outPath);
  }

  return outPath;
}

async function main() {
  const songs = [];
  let lvlMax = 0;
  const ui = reportQueueStatusLive();
  const log = (whatever) => ui.log.write(whatever);
  const targetFile = path.join(__dirname, "../src/songs/smx.json");
  const existingData = require(targetFile);
  const indexedSongs = {};
  for (const song of existingData.songs) {
    indexedSongs[song.saIndex] = song;
  }

  log(`pulling chart details`);
  const req = await fetch(`https://statmaniax.com/api/get_song_data`);
  const songsById = await req.json();

  for (const [songId, song] of Object.entries(songsById)) {
    if (!songs[songId]) {
      songs[songId] = {
        ...indexedSongs[songId],
        saIndex: songId,
        name: song.title,
        artist: song.artist,
        genre: song.genre,
        bpm: song.bpm,
        year: song.created_at.slice(0, 4),
        jacket: queueJacketDownload(song.cover_path),
        charts: [],
      };
      if (!indexedSongs[songId]) {
        ui.log.write(`added new song: ${song.title}`);
      }
    }
    for (const diff of Object.values(song.difficulties)) {
      const isPlus = diff.name.endsWith("+");
      if (isPlus) {
        diff.name = diff.name.slice(0, -1);
      }
      const chart = {
        style: diff.name === "team" ? "team" : "solo",
        lvl: +diff.difficulty,
        diffClass: diff.name,
      };
      if (isPlus) {
        chart.flags = ["plus"];
      }
      songs[songId].charts.push(chart);
      lvlMax = Math.max(lvlMax, chart.lvl);
    }
  }

  const smxData = {
    ...existingData,
    songs: songs.filter((s) => !!s),
  };

  smxData.meta.lvlMax = lvlMax;

  ui.log.write("finished downloading data, writing final JSON output");
  await writeJsonData(smxData, resolve(targetFile));

  if (requestQueue.size) {
    ui.log.write("waiting on images to finish downloading...");
    await requestQueue.onIdle();
  }
  ui.log.write("done!");
  ui.close();
}

main().catch((e) => {
  ui.close();
  console.error(e);
});

/**
 * Script to import SMX data from direct from their API
 */

const path = require("path");
const { resolve, join } = require("path");
const fetch = require("node-fetch");
const {
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
  writeJsonData,
} = require("./utils");

const difficulties = [
  "basic",
  "easy",
  "hard",
  "wild",
  "dual",
  "full",
  "team", // ignore, don't see a use case
];

const GET_IMAGES = true;

/**
 * queues a cover path for download,
 * returns the filename that will eventually be used
 */
function queueJacketDownload(coverPath) {
  const coverStub = coverPath.split("/")[2];
  const outPath = `smx/${coverStub}.jpg`;
  if (GET_IMAGES) {
    downloadJacket(`https://data.stepmaniax.com/${coverPath}`, outPath);
  }

  return outPath;
}

async function getData(log, diff) {
  log(`pulling ${diff} chart details`);
  const req = await requestQueue.add(
    () =>
      fetch(`https://data.stepmaniax.com/highscores/region/all/${diff}`, {
        method: "POST",
      }),
    {
      priority: 1,
    }
  );
  const data = await req.json();
  return {
    charts: data.charts,
    songs: data.songs,
    diff,
  };
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

  const remoteData = await Promise.all(
    difficulties.map(getData.bind(undefined, log))
  );

  for (const { charts, songs: remoteSongs, diff } of remoteData) {
    for (const chart of Object.values(charts)) {
      if (!songs[chart.song_id]) {
        const songSource = remoteSongs[chart.song_id];
        songs[chart.song_id] = {
          ...indexedSongs[chart.song_id],
          saIndex: chart.song_id.toString(),
          name: songSource.title,
          artist: songSource.artist,
          genre: songSource.genre,
          bpm: songSource.bpm,
          jacket: queueJacketDownload(songSource.cover),
          charts: [],
        };
        if (!indexedSongs[chart.song_id]) {
          ui.log.write(`added new song: ${songSource.title}`);
        }
      }
      songs[chart.song_id].charts.push({
        style: diff === "team" ? "team" : "solo",
        lvl: chart.difficulty,
        diffClass: diff,
        author: chart.steps_author,
      });
      if (chart.difficulty > lvlMax) {
        lvlMax = chart.difficulty;
      }
    }
  }

  const smxData = {
    ...existingData,
    songs: songs.filter((s) => !!s),
  };

  ui.log.write("finished downloading data, writing final JSON output");
  await writeJsonData(
    smxData,
    resolve(join(__dirname, "../src/songs/smx.json"))
  );

  if (requestQueue.size) {
    ui.log.write("waiting on images to finish downloading...");
    await requestQueue.onIdle();
  }
  ui.log.write("done!");
  ui.close();
}

main().catch((e) => {
  console.error(e);
});

/**
 * Script to import SMX data from direct from their API
 */

const fs = require("fs");
const path = require("path");
const { resolve, join } = require("path");
const prettier = require("prettier");
const fetch = require("node-fetch");
const {
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
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
    downloadJacket(
      `https://data.stepmaniax.com/${coverPath}/cover.png`,
      outPath
    );
  }

  return outPath;
}

async function main() {
  const songs = [];
  let lvlMax = 0;
  const ui = reportQueueStatusLive();
  const targetFile = path.join(__dirname, "../src/songs/smx.json");
  const existingData = require(targetFile);
  const indexedSongs = {};
  for (const song of existingData.songs) {
    if (indexedSongs[song.name]) {
      ui.log.write(`Duplicate song title: ${song.name}`);
    }
    indexedSongs[song.name] = song;
  }

  for (const diff of difficulties) {
    ui.log.write(`pulling ${diff} chart details`);
    const data = await requestQueue.add(
      () =>
        fetch(`https://data.stepmaniax.com/highscores/region/all/${diff}`, {
          method: "POST",
        }),
      {
        priority: 1,
      }
    );
    const { highscores } = await data.json();
    for (const score of highscores) {
      if (!songs[score.song_id]) {
        songs[score.song_id] = {
          ...indexedSongs[score.song.title],
          saIndex: score.song_id.toString(),
          name: score.song.title,
          artist: score.song.artist,
          genre: score.song.genre,
          bpm: score.song.bpm,
          jacket: queueJacketDownload(score.song.cover_path),
          charts: [],
        };
        if (!indexedSongs[score.song.title]) {
          ui.log.write(`added new song: ${score.song.title}`);
        }
      }
      songs[score.song_id].charts.push({
        style: diff === "team" ? "team" : "solo",
        lvl: score.difficulty,
        diffClass: diff,
        author: score.steps_author,
      });
      if (score.difficulty > lvlMax) {
        lvlMax = score.difficulty;
      }
    }
  }

  const smxData = {
    ...existingData,
    songs: songs.filter((s) => !!s),
  };

  ui.log.write("finished downloading data, writing final JSON output");
  await fs.promises.writeFile(
    resolve(join(__dirname, "../src/songs/smx.json")),
    prettier.format(JSON.stringify(smxData), {
      filepath: "smx.json",
    })
  );

  if (requestQueue.size) {
    ui.log.write("waiting on images to finish downloading...");
    await requestQueue.onIdle();
  }
  ui.log.write("done!");
  ui.close();
}

main();

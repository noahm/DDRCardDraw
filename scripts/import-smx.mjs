// @ts-check

/**
 * Script to import SMX data from direct from statmaniax (thanks cube!)
 */

import { join, resolve, dirname } from "path";
import { fetch, Agent, setGlobalDispatcher } from "undici";
import { readFile } from "fs/promises";
import {
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
  writeJsonData,
} from "./utils.mjs";

const GET_IMAGES = true;
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * queues a cover path for download,
 * returns the filename that will eventually be used
 */
function queueJacketDownload(coverPath) {
  coverPath = join(coverPath, "cover.png");
  const coverStub = coverPath.split("/")[2];
  const outPath = `smx/${coverStub}.jpg`;
  if (GET_IMAGES) {
    downloadJacket(`https://data.stepmaniax.com/${coverPath}`, outPath);
  }

  return outPath;
}
const ui = reportQueueStatusLive();
try {
  const songs = [];
  const log = (whatever) => ui.log.write(whatever);
  const targetFile = join(__dirname, "../src/songs/smx.json");
  const existingData = JSON.parse(
    await readFile(targetFile, { encoding: "utf-8" }),
  );
  const indexedSongs = {};
  for (const song of existingData.songs) {
    indexedSongs[song.saIndex] = song;
  }

  log(`pulling chart details`);
  let songsById;
  try {
    // added in case statmaniax is under load from cab updates and can't
    // handle TLS handshakes in time for the default timeout
    const dispatcher = new Agent({ connectTimeout: 30_000 });
    const req = await fetch(`https://statmaniax.com/api/get_song_data`, {
      dispatcher,
    });
    songsById = await req.json();
    setGlobalDispatcher(dispatcher);
  } catch (e) {
    ui.close();
    console.error(e);
    process.exit(1);
  }

  for (const [songId, song] of Object.entries(songsById)) {
    if (!songs[songId]) {
      songs[songId] = {
        ...indexedSongs[songId],
        saIndex: songId,
        name: song.title,
        artist: song.artist,
        genre: song.genre,
        bpm: song.bpm,
        jacket: queueJacketDownload(song.cover_path),
        charts: [],
      };
      if (!indexedSongs[songId]) {
        ui.log.write(`added new song: ${song.title}`);
      }
    }
    for (const diff of Object.values(song.difficulties)) {
      if (!diff.name) {
        ui.log.write(`skipping bunk chart for ${song.title}`);
        continue;
      }
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
    }
  }

  const smxData = {
    ...existingData,
    songs: songs.filter((s) => !!s),
  };

  ui.log.write("finished downloading data, writing final JSON output");
  await writeJsonData(smxData, resolve(targetFile));

  if (requestQueue.size) {
    ui.log.write("waiting on images to finish downloading...");
    await requestQueue.onIdle();
  }
  ui.log.write("done!");
} catch (e) {
  ui.log.write(e);
} finally {
  ui.close();
}

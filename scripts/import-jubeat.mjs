// @ts-check
import * as fs from "fs";
import * as path from "path";
import {
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
  writeJsonData,
} from "./utils.mjs";
import bettersqlite from "better-sqlite3";

import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @typedef {import("../src/models/SongData.js").Song} Song */
/** @typedef {import("../src/models/SongData.js").Chart} Chart */
/** @typedef {import("../src/models/SongData.js").GameData} GameData */

// db file expected to be the output from https://github.com/zetaraku/arcade-songs-fetch
const DATABASE_FILE = "db.sqlite3";
const DATA_STUB = "jubeat-ave";
const JACKET_DIR = "jubeat";

if (!fs.existsSync(DATABASE_FILE)) {
  console.error(
    "No local data found, download a copy from the url below and save it as pump.db",
    "  https://github.com/AnyhowStep/pump-out-sqlite3-dump/tree/master/dump",
  );
  process.exit(0);
}

const GET_IMAGES = true;

/**
 *
 * @param {string} jacketUri
 */
function queueJacketDownload(jacketUri) {
  const filename = path.basename(new URL(jacketUri).pathname, ".gif");
  const outPath = `${JACKET_DIR}/${filename}.jpg`;
  if (GET_IMAGES) {
    downloadJacket(jacketUri, outPath);
  }

  return outPath;
}

/** @typedef {{ id: string; title: string; artist: string; imageUrl: string; }} DbSong */
/** @typedef {{ songId: string; type: string; difficulty: string; level: string; }} Sheet */

// main procedure
try {
  const db = bettersqlite(DATABASE_FILE);
  const ui = reportQueueStatusLive();

  /** @type {Array<DbSong>} */
  const songs = db
    .prepare(
      `SELECT
songId id,
title,
artist,
imageUrl
FROM
Songs;`,
    )
    .all();

  /** @type {Array<Sheet>} */
  const sheets = db
    .prepare(
      `
SELECT
	songId,
  type,
  difficulty,
  level
FROM
	Sheets;`,
    )
    .all();

  /** @type {Map<string, Song>} */
  const songsById = new Map();
  ui.log.write(`Iterating across ${songs.length} songs`);
  for (const song of songs) {
    songsById.set(song.id, {
      artist: song.artist,
      bpm: "",
      charts: [],
      jacket: queueJacketDownload(song.imageUrl),
      name: song.title,
    });
  }

  for (const sheet of sheets) {
    const song = songsById.get(sheet.songId);
    if (!song) {
      ui.log.write(`Missing song ${sheet.songId} for sheet`);
      continue;
    }
    /** @type {Chart} */
    const chartData = {
      lvl: parseFloat(sheet.level),
      diffClass: sheet.difficulty,
      style: "solo",
    };

    if (sheet.type !== "std") {
      chartData.flags = [sheet.type];
    }

    song.charts.push(chartData);
  }

  /** @type {GameData} */
  const data = {
    meta: {
      menuParent: "more",
      styles: ["solo"],
      difficulties: [
        { key: "basic", color: "#7fc344" },
        { key: "advanced", color: "#e28831" },
        { key: "extreme", color: "#e12a5a" },
      ],
      flags: [],
      lastUpdated: Date.now(),
    },
    defaults: {
      style: "solo",
      difficulties: ["basic", "advanced", "extreme"],
      flags: [],
      lowerLvlBound: 1,
      upperLvlBound: 10.9,
    },
    i18n: {
      en: {
        name: "Jubeat Avenue",
        solo: "Single",
        basic: "Basic",
        advanced: "Advanced",
        extreme: "Extreme",
        $abbr: {
          basic: "BSC",
          advanced: "ADV",
          extreme: "EXT",
        },
      },
    },
    songs: Array.from(songsById.values()),
  };

  db.close();

  await writeJsonData(
    data,
    path.resolve(path.join(__dirname, `../src/songs/${DATA_STUB}.json`)),
  );
  if (requestQueue.size) {
    ui.log.write("waiting on images to finish downloading...");
    await requestQueue.onIdle();
  }
  ui.log.write("done!");
  ui.close();
} catch (e) {
  console.error(e);
}

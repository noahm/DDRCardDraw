#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import task from "tasuku";
import {
  downloadJacket,
  reportQueueStatusLive,
  writeJsonData,
} from "./utils.mts";
import { MAIMAI_PATCH } from "./maimai/maimai-patches.mjs";
import { Chart, GameData, Song } from "../src/models/SongData.ts";

const [, , inputPath] = process.argv;
if (!inputPath) {
  console.error("Usage: yarn import:maimai <path-to-maimai-database.json>");
  process.exit(1);
}

const hash = crypto.createHash("sha256");

/**
 * compute an abbreviated hash of `input`
 */
function shortHash(input: string, length = 12) {
  return hash.update(input).digest("base64").slice(0, length);
}

const OUTPUT_PATH = "src/songs/maimai.json";

function normalizeSong(song): Song {
  const flags = [];
  const hasUtage = song.sheets.some((sheet) => sheet.type === "utage");
  const warnings = [];

  // --- song-level checks ---
  if (!song.title) warnings.push("Missing title");
  if (!song.artist) warnings.push("Missing artist");
  if (!song.imageName) warnings.push("Missing jacket URL");
  if (!song.version) warnings.push("Missing version/folder");

  if (song.bpm == null) {
    warnings.push("Missing BPM (null/undefined)");
  }

  const bpmValue = hasUtage
    ? "???"
    : song.bpm != null
      ? song.bpm.toString()
      : "0";

  if (bpmValue === "0") {
    warnings.push("BPM defaulted to 0");
  }

  // --- flags logic (unchanged) ---
  if (
    song.isLocked &&
    !["Xaleid◆scopiX", "Ref:rain (for 7th Heaven)"].includes(song.title)
  ) {
    flags.push("unlockable");
  }

  const hasJpnOnly = song.sheets.some(
    (sheet) =>
      sheet.regions &&
      sheet.regions.jp === true &&
      sheet.regions.intl === false &&
      sheet.regions.usa === false,
  );

  const hasIntlNoUsa = song.sheets.some(
    (sheet) =>
      sheet.regions &&
      sheet.regions.jp === true &&
      sheet.regions.intl === true &&
      sheet.regions.usa === false,
  );

  // JP-only songs
  if (hasJpnOnly) {
    flags.push("jpn");
  }

  // International but not USA
  if (!hasJpnOnly && hasIntlNoUsa) {
    flags.push("usa");
  }

  if (["Xaleid◆scopiX", "Ref:rain (for 7th Heaven)"].includes(song.title)) {
    flags.push("long");
  }

  // --- chart normalization + chart warnings ---
  const charts = (song.sheets as Array<any>).map<Chart>((sheet, index) => {
    let diffClass = sheet.difficulty;
    let extras = sheet.type;

    if (!sheet.difficulty) {
      warnings.push(`Chart ${index}: Missing difficulty`);
    }

    if (sheet.internalLevelValue == null) {
      warnings.push(`Chart ${index}: Missing internalLevelValue`);
    }

    if (!sheet.type) {
      warnings.push(`Chart ${index}: Missing chart type`);
    }

    if (sheet.type === "utage") {
      const temp = diffClass;
      diffClass = extras;
      extras = temp;
    }

    return {
      style: "single",
      diffClass,
      lvl: sheet.internalLevelValue,
      extras,
    };
  });

  if (warnings.length > 0) {
    console.warn({
      title: song.title ?? "(unknown title)",
      songId: song.songId ?? null,
      warnings,
    });
  }

  return {
    name: song.title,
    artist: song.artist,
    bpm: bpmValue,
    jacket: song.imageName
      ? downloadJacket(song.imageName, `maimai/${shortHash(song.songId)}.jpg`)
      : null,
    folder: song.version,
    ...(flags.length > 0 && { flags }),
    charts,
  };
}

task("Import MaiMai Data", async function ({ setStatus, setTitle, task }) {
  const cleanup = reportQueueStatusLive(task);
  setStatus("Reading MaiMai source data...");
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

  // --- Apply patches from MAIMAI_PATCH ---
  const patchedSongs = (raw.songs as Array<any>).map((song) => {
    const patch = MAIMAI_PATCH[song.songId] || MAIMAI_PATCH[song.title];
    if (!patch) return song;

    // Map patch fields to raw JSON keys
    if (patch.title !== undefined) song.title = patch.title;
    if (patch.artist !== undefined) song.artist = patch.artist;
    if (patch.bpm !== undefined) song.bpm = patch.bpm;
    if (patch.imageName !== undefined) song.imageName = patch.imageName;
    if (patch.version !== undefined) song.version = patch.version;

    // Merge chart-level patches
    if (Array.isArray(patch.charts) && Array.isArray(song.sheets)) {
      song.sheets = song.sheets.map((sheet, idx) => {
        const chartPatch = patch.charts.find((c) => c.index === idx);
        if (!chartPatch) return sheet;

        return {
          ...sheet,
          difficulty: chartPatch.diffClass ?? sheet.difficulty,
          internalLevelValue: chartPatch.lvl ?? sheet.internalLevelValue,
          type: chartPatch.extras ?? sheet.type,
        };
      });
    }

    setStatus(`Applied patch for song: ${song.title ?? song.songId}`);
    return song;
  });

  setStatus("Normalizing data...");
  baseGameData.songs = patchedSongs.map(normalizeSong);

  setStatus("Writing data...");
  await writeJsonData(baseGameData, OUTPUT_PATH);

  setStatus(`Wrote ${OUTPUT_PATH}`);
  cleanup();
});

const baseGameData: GameData = {
  meta: {
    lastUpdated: 0,
    menuParent: "more",
    styles: ["single"],
    difficulties: [
      { key: "basic", color: "#22bb5b" },
      { key: "advanced", color: "#fb9c2d" },
      { key: "expert", color: "#f64861" },
      { key: "master", color: "#9e45e2" },
      { key: "remaster", color: "#4e098f" },
      { key: "utage", color: "#ff85fe" },
    ],
    folders: [
      "maimai",
      "maimai PLUS",
      "GreeN",
      "GreeN PLUS",
      "ORANGE",
      "ORANGE PLUS",
      "PiNK",
      "PiNK PLUS",
      "MURASAKi",
      "MURASAKi PLUS",
      "MiLK",
      "MiLK PLUS",
      "FiNALE",
      "maimaiでらっくす",
      "maimaiでらっくす PLUS",
      "Splash",
      "Splash PLUS",
      "UNiVERSE",
      "UNiVERSE PLUS",
      "FESTiVAL",
      "FESTiVAL PLUS",
      "BUDDiES",
      "BUDDiES PLUS",
      "PRiSM",
      "PRiSM PLUS",
      "CiRCLE",
    ],
    flags: ["unlockable", "long", "jpn", "usa"],
  },
  defaults: {
    style: "single",
    difficulties: ["expert", "master", "remaster"],
    flags: [],
    lowerLvlBound: 12,
    upperLvlBound: 14,
  },
  i18n: {
    en: {
      name: "maimai DX",
      single: "Single",
      basic: "BASIC",
      advanced: "ADVANCED",
      expert: "EXPERT",
      master: "MASTER",
      remaster: "RE:MASTER",
      utage: "UTAGE",
      unlockable: "Unlockables",
      long: "Long Songs",
      jpn: "JPN Exclusive Songs",
      usa: "USA Ver. Hidden Songs",
      $abbr: {
        basic: "BAS",
        advanced: "ADV",
        expert: "EXP",
        master: "MAS",
        remaster: "RE:MAS",
        utage: "UTA",
      },
    },
    ja: {
      name: "maimai DX",
      single: "Single",
      basic: "BASIC",
      advanced: "ADVANCED",
      expert: "EXPERT",
      master: "MASTER",
      remaster: "RE:MASTER",
      utage: "UTAGE",
      unlockable: "Unlockables",
      long: "Long Songs",
      jpn: "JPN Exclusive Songs",
      usa: "USA Ver. Hidden Songs",
      $abbr: {
        basic: "BAS",
        advanced: "ADV",
        expert: "EXP",
        master: "MAS",
        remaster: "RE:MAS",
        utage: "UTA",
      },
    },
  },
  songs: [],
};

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import task from "tasuku";
import {
  downloadJacket,
  reportQueueStatusLive,
  writeJsonData,
} from "./utils.mts";
import "./maimai/sslfix.mts";
import { MAIMAI_PATCH } from "./maimai/maimai-patches.mjs";
import type { Chart, GameData, Song } from "../src/models/SongData.ts";

const [, , inputPath] = process.argv;
if (!inputPath) {
  console.error("Usage: yarn import:maimai <path-to-maimai-database.json>");
  process.exit(1);
}

/**
 * preserves original filename, convert to jpg
 */
function localImageName(input: string) {
  const imageSansExt = path.basename(input).slice(0, -4);
  return `maimai/${imageSansExt}.jpg`;
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

  interface Sheet {
    difficulty: string;
    type: string;
    internalLevelValue: null | number;
  }

  // --- chart normalization + chart warnings ---
  const charts = (song.sheets as Array<Sheet>).map((sheet, index): Chart => {
    const flags = [];
    if (!sheet.difficulty) {
      warnings.push(`Chart ${index}: Missing difficulty`);
    }

    if (sheet.internalLevelValue == null) {
      warnings.push(`Chart ${index}: Missing internalLevelValue`);
    }

    if (!sheet.type) {
      warnings.push(`Chart ${index}: Missing chart type`);
    }

    // --- flags logic ---
    if (sheet.regions) {
      const { jp, intl, usa } = sheet.regions;

      if (jp && !intl && !usa) {
        flags.push("jpn");
      } else if (jp && intl && !usa) {
        flags.push("usa");
      }
    }

    if (
      song.isLocked &&
      !["Xaleid◆scopiX", "Ref:rain (for 7th Heaven)"].includes(song.title)
    ) {
      flags.push("unlockable");
    }

    if (["Xaleid◆scopiX", "Ref:rain (for 7th Heaven)"].includes(song.title)) {
      flags.push("long");
    }

    let diffClass: string, type: string;
    if (sheet.type === "utage") {
      diffClass = sheet.type;
      type = sheet.difficulty;
    } else {
      diffClass = sheet.difficulty;
      type = sheet.type;
    }

    return {
      style: "single",
      diffClass,
      lvl: sheet.internalLevelValue,
      ...(flags.length > 0 && { flags }),
      extras: [type],
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
      ? downloadJacket(song.imageName, localImageName(song.imageName))
      : null,
    folder: song.version,
    charts,
  };
}

const baseGameData: GameData = {
  $schema: "../../songs.schema.json",
  meta: {
    lastUpdated: 0,
    menuParent: "more",
    cardVariant: "maimai",
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

task("Import MaiMai Data", async function ({ setStatus, setTitle, task }) {
  const cleanup = reportQueueStatusLive(task);
  setStatus("Reading MaiMai source data...");
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

  // --- Apply patches from MAIMAI_PATCH ---
  const patchedSongs = (raw.songs as Array<any>).map((song) => {
    const patch = MAIMAI_PATCH[song.songId] || MAIMAI_PATCH[song.title];
    if (!patch) return song;

    Object.assign(song, patch);

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

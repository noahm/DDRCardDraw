#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { writeJsonData } from "./utils.mts";
import { MAIMAI_PATCH } from "./maimai/maimai-patches.mjs";
import { fetchMaimaiJackets } from "./maimai/maimai-fetch-images.mjs";

const [, , inputPath] = process.argv;
if (!inputPath) {
  console.error("Usage: yarn import:maimai <path-to-maimai-database.json>");
  process.exit(1);
}

const OUTPUT_PATH = "src/songs/maimai.json";
const WARNINGS_OUTPUT_PATH = "./scripts/maimai/song-info-warnings.json";
const songWarnings = [];

async function normalizeSong(song) {
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
  const charts = song.sheets.map((sheet, index) => {
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

  // --- store warnings if any ---
  if (warnings.length > 0) {
    songWarnings.push({
      title: song.title ?? "(unknown title)",
      songId: song.songId ?? null,
      warnings,
    });
  }

  if (!song.jacket) warnings.push("Missing jacket filepath");

  return {
    name: song.title,
    artist: song.artist,
    bpm: bpmValue,
    jacket: song.jacket ?? null,
    folder: song.version,
    ...(flags.length > 0 && { flags }),
    charts,
  };
}

async function run() {
  console.info("📥 Reading MaiMai source data...");
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

  // --- Apply patches from MAIMAI_PATCH ---
  raw.songs = raw.songs.map((song) => {
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

    console.info(`🩹 Applied patch for song: ${song.title ?? song.songId}`);
    return song;
  });

  // --- Fetch MaiMai jackets AFTER patches and assign correct relative paths ---
  await fetchMaimaiJackets(raw.songs);

  // Assign relative paths for each song
  raw.songs.forEach((index, song) => {
    if (song.imageName) {
      const jacketName = `${index + 1}.png`; // sanitized filename
      song.jacket = `maimai/${jacketName}`;
    }
  });

  // --- Verify jackets ---
  console.info("🔍 Verifying jackets for all songs...");
  raw.songs.forEach((song) => {
    if (song.jacket) {
      console.log(`✅ ${song.title} -> ${song.jacket}`);
    } else {
      console.warn(`⚠️ ${song.title} has no jacket saved`);
    }
  });

  const songs = await Promise.all(raw.songs.map(normalizeSong));

  const gameData = {
    meta: {
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
    songs,
  };

  await writeJsonData(gameData, OUTPUT_PATH);

  console.info(`✅ Wrote ${OUTPUT_PATH}`);
  console.info("🎉 MaiMai import complete!");
}

run().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});

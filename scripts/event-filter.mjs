// @ts-check
import { readFile } from "fs/promises";
import * as path from "path";
import { DDR_WORLD as MIX_META } from "./scraping/ddr-sources.mjs";
import { writeJsonData } from "./utils.mjs";
import pp from "papaparse";

const targetFile = path.join(import.meta.dirname, "../src/songs", "motl6.json");

const sourceFile = path.join(
  import.meta.dirname,
  "../src/songs",
  MIX_META.filename,
);
/** @type {import('../src/models/SongData.js').GameData} */
const existingData = JSON.parse(
  await readFile(sourceFile, { encoding: "utf-8" }),
);
existingData.i18n.en.name = "MotL6 DDR";
existingData.i18n.ja.name = "MotL6 DDR";
existingData.meta.menuParent = "events";
existingData.meta.styles = ["single"];
delete existingData.meta.folders;
existingData.meta.flags = ["shock"];
existingData.defaults.flags = ["shock"];
existingData.defaults.difficulties.push("basic");

const csvFile = process.argv[2];
if (!csvFile) {
  console.log(
    `No data file provided. Invoke like 'yarn import:eventList path/to/song-list.csv'`,
  );
  process.exit();
}

const songlistData = pp.parse(await readFile(csvFile, { encoding: "utf-8" }), {
  header: true,
});

/**
 *
 * @param {string} a
 * @param {string} b
 * @returns
 */
function comp(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

/** @param {import('../src/models/SongData.js').Chart} chart  */
function normalizeDiff(chart) {
  switch (chart.diffClass) {
    case "beginner":
      return "BEG";
    case "basic":
      return "BSC";
    case "difficult":
      return "DIF";
    case "expert":
      return "EXP";
    case "challenge":
      return "CHA";
  }
}

/**
 * deletes all flags other than shock
 * @param {{flags?: string[]}} flaggable
 */
function clearFlags(flaggable) {
  if (flaggable.flags?.includes("shock")) {
    flaggable.flags = ["shock"];
  } else {
    delete flaggable.flags;
  }
}

let totalCharts = 0;

existingData.songs = existingData.songs.filter((song) => {
  const matching = songlistData.data.filter((row) => comp(row.Song, song.name));
  if (!matching.length) return false;
  song.charts = song.charts.filter((chart) => {
    if (chart.style !== "single") return false;
    clearFlags(chart);
    return matching.some((row) => row.Difficulty === normalizeDiff(chart));
  });
  if (song.charts.length) {
    totalCharts += song.charts.length;
    clearFlags(song);
    return true;
  }
  console.log("filtered all", song);
  return false;
});

await writeJsonData(existingData, targetFile);

console.log(
  `Wrote ${totalCharts} (${
    songlistData.data.length
  } target) charts to ${path.basename(targetFile)}`,
);

// console.log("Missing songs", missing);

console.log("Done");

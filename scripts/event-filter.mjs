// @ts-check
import { readFile } from "fs/promises";
import * as path from "path";
import { writeJsonData } from "./utils.mjs";
import pp from "papaparse";

const targetFile = path.join(
  import.meta.dirname,
  "../src/songs",
  "motl6-iidx.json",
);

const sourceFile = path.join(import.meta.dirname, "../src/songs/iidx.json");
/** @type {import('../src/models/SongData.js').GameData} */
const existingData = JSON.parse(
  await readFile(sourceFile, { encoding: "utf-8" }),
);
existingData.i18n.en.name = "MotL6 IIDX";
existingData.i18n.ja.name = "MotL6 IIDX";
existingData.meta.menuParent = "events";
existingData.meta.styles = ["single"];
// delete existingData.meta.folders;
// existingData.meta.flags = ["shock"];
// existingData.defaults.flags = ["shock"];
// existingData.defaults.difficulties.push("basic");

const csvFile = process.argv[2];
if (!csvFile) {
  console.log(
    `No data file provided. Invoke like 'yarn import:eventList path/to/song-list.csv'`,
  );
  process.exit();
}

/** @type {pp.ParseResult<{name:string;newLvl:number;diffClass:string}>} */
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

// existingData.songs = existingData.songs.filter((song) => {
//   const matching = songlistData.data.filter((row) => comp(row.name, song.name));
//   if (!matching.length) return false;
//   song.charts = song.charts.filter((chart) => {
//     if (chart.style !== "single") return false;
//     // clearFlags(chart);
//     return matching.some(
//       (row) => (row.diffClass || "another") === chart.diffClass,
//     );
//   });
//   if (song.charts.length) {
//     totalCharts += song.charts.length;
//     // clearFlags(song);
//     return true;
//   }
//   console.log("filtered all", song);
//   return false;
// });

songlistData.data.forEach((row) => {
  const foundSong = existingData.songs.find((s) => s.name === row.name.trim());
  if (!foundSong) {
    console.log("missing: ", row.name);
    return;
  }
  foundSong.charts = foundSong.charts.filter((c) => c.style === "single");
  const foundChart = foundSong.charts.find(
    (c) => c.diffClass === (row.diffClass || "another"),
  );
  if (!foundChart) {
    console.log(`missing ${row.diffClass || "another"} for `, row.name);
    return;
  }
  foundChart.lvl = +row.newLvl;
});

await writeJsonData(existingData, targetFile);

console.log(
  `Wrote ${totalCharts} (${
    songlistData.data.length
  } target) charts to ${path.basename(targetFile)}`,
);

// const missing = songlistData.data.filter((row) =>
//   existingData.songs.some((song) => song.name === row.name),
// );
// console.log("Missing songs", missing);

console.log("Done");

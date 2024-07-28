import { fileURLToPath } from "node:url";
import { DDR_A3 as MIX_META } from "./scraping/ddr-sources.mjs";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { writeJsonData } from "./utils.mjs";
import papa from "papaparse";

const sourceFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/songs",
  MIX_META.filename,
);
/** @type {import("../src/models/SongData.js").GameData} */
const existingData = JSON.parse(
  await readFile(sourceFile, { encoding: "utf-8" }),
);

/** @type {import("papaparse").ParseResult<{ Song: string, Difficulty: "EXPERT" | "DIFFICULT" | "CHALLENGE" }>} */
const voteResults = papa.parse(
  await readFile(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../bite7curated.csv",
    ),
    { encoding: "utf-8" },
  ),
  { header: true },
);

const newData = {
  ...existingData,
  songs: voteResults.data.map((inductee) => {
    const sourceSong = existingData.songs.find(
      (song) => song.name === inductee.Song,
    );
    if (!sourceSong) {
      console.log(inductee);
      throw new Error(`could not find song by title ${inductee.Song}`);
    }
    const targetDiff = inductee.Difficulty.toLowerCase();
    const sourceChart = sourceSong.charts.filter(
      (chart) => chart.diffClass === targetDiff && chart.style === "single",
    );
    if (sourceChart.length !== 1) {
      throw new Error(
        `wrong number of charts matching filter, found ${sourceChart.length}`,
      );
    }
    return {
      ...sourceSong,
      charts: sourceChart,
    };
  }),
};

const targetFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/songs/bite7.json",
);
await writeJsonData(newData, targetFile);

import { DDR_WORLD as MIX_META } from "./scraping/ddr-sources.mjs";
import path from "node:path";
import { readFile } from "node:fs/promises";

const sourceFile = path.join(
  import.meta.dirname,
  "../src/songs",
  MIX_META.filename,
);
/** @type {import("../src/models/SongData.js").GameData} */
const existingData = JSON.parse(
  await readFile(sourceFile, { encoding: "utf-8" }),
);

for (const song of existingData.songs) {
  for (const chart of song.charts) {
    if (chart.sanbaiTier && chart.lvl !== Math.floor(chart.sanbaiTier)) {
      console.log(song.name, chart.diffClass, chart.style);
    }
  }
}

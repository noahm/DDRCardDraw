import { getDifficultyList } from "./scraping/sanbai.mjs";
import { DDR_A3 as MIX_META } from "./scraping/ddr-sources.mjs";
import * as path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import {
  writeJsonData,
  requestQueue,
  reportQueueStatusLive,
} from "./utils.mjs";

/**
 *
 * @param {string} diffClass
 * @param {string} style
 * @returns
 */
function diffIdxFor(diffClass, style) {
  return [
    "single:beginner",
    "single:basic",
    "single:difficult",
    "single:expert",
    "single:challenge",
    "double:basic",
    "double:difficult",
    "double:expert",
    "double:challenge",
  ].indexOf(`${style}:${diffClass}`);
}

/**
 *
 * @param {string} id
 * @param {string} diffClass
 * @param {string} style
 * @returns
 */
function chartKeyFor(id, diffClass, style) {
  return `${id}/${diffIdxFor(diffClass, style)}`;
}

const targetFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/songs",
  MIX_META.filename,
);

const existingData = JSON.parse(
  await readFile(targetFile, { encoding: "utf-8" }),
);

/** @type {Record<string, ReturnType<typeof getDifficultyList>>} */
const ratingsLists = {};

/**
 * @param {number} difficulty
 * @param {string} style
 */
function getCachedDifficultyList(difficulty, style) {
  const key = `${style}:${difficulty}`;
  if (!ratingsLists[key]) {
    ratingsLists[key] = requestQueue.add(
      () => getDifficultyList(difficulty, style),
      {
        throwOnTimeout: true,
      },
    );
  }
  return ratingsLists[key];
}

let warnings = 0;
const ui = reportQueueStatusLive();
for (const song of existingData.songs) {
  for (const chart of song.charts) {
    getCachedDifficultyList(chart.lvl, chart.style).then(
      (difficultyRatings) => {
        const chartKey = chartKeyFor(song.saHash, chart.diffClass, chart.style);
        const maybeRating = difficultyRatings[chartKey];
        if (!maybeRating) {
          ui.log.write(`No tier for ${song.name} - ${chartKey}`);
          warnings++;
        } else {
          chart.sanbaiTier = chart.lvl + maybeRating.tier;
        }
      },
    );
  }
}

await requestQueue.onIdle();
await new Promise((resolve) => {
  setTimeout(resolve, 500);
});
await writeJsonData(existingData, targetFile);
if (warnings) {
  ui.log.write(`Done, with ${warnings} warnings`);
} else {
  ui.log.write("Done");
}
ui.close();

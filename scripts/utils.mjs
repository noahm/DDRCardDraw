import { promises, existsSync } from "fs";
import { resolve, basename, join, dirname } from "path";
import { format } from "prettier";
import PQueue from "p-queue";
import jimp from "jimp";
import BottomBar from "inquirer/lib/ui/bottom-bar.js";
import sanitize from "sanitize-filename";

import { JSDOM } from "jsdom";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

import CacheableLookup from "cacheable-lookup";
import { globalAgent as httpAgent } from "http";
import { globalAgent as httpsAgent } from "https";
{
  /* globally install dns caching to avoid mass lookups of remywiki over and over */
  const dnsCache = new CacheableLookup();
  dnsCache.install(httpAgent);
  dnsCache.install(httpsAgent);
}

/**
 * @param {string} url
 */
async function getDomInternal(url) {
  try {
    return JSDOM.fromURL(url);
  } catch (e) {
    console.error(e);
  }
}

export function getDom(url) {
  return requestQueue.add(() => getDomInternal(url));
}

export async function writeJsonData(data, filePath) {
  data.meta.lastUpdated = Date.now();
  let formatted;
  try {
    formatted = await format(JSON.stringify(data), { filepath: filePath });
  } catch (e) {
    throw new Error("Formatting failed", { cause: e });
  }
  return promises.writeFile(filePath, formatted);
}

/** @type {PQueue} */
export const requestQueue = new PQueue({
  concurrency: 6, // 6 concurrent max
  interval: 1000,
  intervalCap: 10, // 10 per second max
});
const JACKETS_PATH = resolve(__dirname, "../src/assets/jackets");

let JACKET_PREFIX = "";
export function setJacketPrefix(prefix) {
  JACKET_PREFIX = prefix;
}

/**
 * @param {string} coverUrl url of file to be fetched
 * @param {string} localFilename known local filename, or song name
 * @returns absolute and relative paths
 */
function getOutputPath(coverUrl, localFilename) {
  if (!localFilename) {
    localFilename = JACKET_PREFIX + basename(coverUrl);
  } else {
    localFilename = JACKET_PREFIX + localFilename;
  }
  if (!localFilename.endsWith(".jpg")) {
    localFilename += ".jpg";
  }
  const sanitizedFilename = sanitize(basename(localFilename)).replaceAll(
    /#/g,
    "",
  );
  const outputPath = join(dirname(localFilename), sanitizedFilename);
  return {
    absolute: join(JACKETS_PATH, outputPath),
    relative: outputPath.replace(/\\/g, "/"),
  };
}

/**
 * @param coverUrl {string} url of image to fetch
 * @param localFilename {string | undefined} override filename found in url
 *
 * queues a cover path for download into the imageQueue.
 * Always skips if file already exists.
 * Immediately returns the relative path to the jacket where it will be saved
 */
export function downloadJacket(coverUrl, localFilename = undefined) {
  const { absolute, relative } = getOutputPath(coverUrl, localFilename);
  if (!existsSync(absolute)) {
    requestQueue
      .add(() => jimp.read(coverUrl), { throwOnTimeout: true })
      .then((img) =>
        img.resize(128, jimp.AUTO).quality(80).writeAsync(absolute),
      )
      .catch((e) => {
        console.error("image download failure");
        console.error(e);
      });
  }

  return relative;
}

/**
 *
 * @param {string} songName
 * @returns {string|undefined} relative output path if jacket exists
 */
export function checkJacketExists(songName) {
  const paths = getOutputPath("", songName);
  if (existsSync(paths.absolute)) {
    return paths.relative;
  } else {
    // console.log(paths.absolute, "does not exist");
  }
}

let jobCount = 0;

class ClosableBottomBar extends BottomBar {
  /** exposes protected method */
  close() {
    super.close();
  }

  /** exposes protected method */
  clean() {
    return super.clean();
  }
}

export function reportQueueStatusLive() {
  const ui = new ClosableBottomBar();

  requestQueue
    .on("add", () => {
      ui.updateBottomBar(queueStatus());
    })
    .on("active", () => {
      ui.updateBottomBar(queueStatus());
    })
    .on("next", () => {
      jobCount++;
      ui.updateBottomBar(queueStatus());
    })
    .on("idle", () => {
      ui.clean();
    });

  return ui;
}

function queueStatus() {
  return `Requests in flight: ${requestQueue.pending} Requests Waiting: ${requestQueue.size} Jobs done: ${jobCount}`;
}

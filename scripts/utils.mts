import { promises, existsSync, mkdirSync } from "node:fs";
import { resolve, basename, join, dirname } from "path";
import { format } from "prettier";
import PQueue from "p-queue";
import { Jimp, ResizeStrategy } from "jimp";
import BottomBar from "inquirer/lib/ui/bottom-bar.js";
import sanitize from "sanitize-filename";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import CacheableLookup from "cacheable-lookup";
import { globalAgent as httpAgent } from "http";
import { globalAgent as httpsAgent } from "https";

import type { GameData, Song } from "../src/models/SongData.ts";

{
  /* globally install dns caching to avoid mass lookups of remywiki over and over */
  const dnsCache = new CacheableLookup();
  dnsCache.install(httpAgent);
  dnsCache.install(httpsAgent);
}

/**
 * sorts songs in-place, and charts within each song
 * @param songs
 */
export function sortSongs(songs: Song[], meta: GameData["meta"]) {
  for (const song of songs) {
    song.charts.sort((left, right) => {
      if (left.style !== right.style) {
        return (
          meta.styles.indexOf(left.style) - meta.styles.indexOf(right.style)
        );
      }
      if (left.diffClass !== right.diffClass) {
        return (
          meta.difficulties.findIndex((d) => d.key === left.diffClass) -
          meta.difficulties.findIndex((d) => d.key === right.diffClass)
        );
      }
      return left.lvl - right.lvl;
    });
  }
  return songs.sort((left, right) => {
    const leftLowerName = left.name.toLowerCase();
    const rightLowerName = right.name.toLowerCase();

    if (leftLowerName === rightLowerName) {
      return left.name == right.name ? 0 : left.name > right.name ? 1 : -1;
    }
    return leftLowerName > rightLowerName ? 1 : -1;
  });
}

/**
 * @param {string} url
 * @returns {Promise<JSDOM | null>}
 */
async function getDomInternal(url: string): Promise<JSDOM | undefined> {
  try {
    console.log("fetching", url);
    const req = await fetch(url);
    return new JSDOM(await req.text());
  } catch (e) {
    console.error("Caught error:", e);
  }
}

const domForUrl: Record<string, JSDOM | undefined> = {};

/**
 *
 * @param url
 */
export async function getDom(url: string): Promise<JSDOM | undefined> {
  if (domForUrl[url]) return domForUrl[url];
  return (domForUrl[url] = await requestQueue.add(() => getDomInternal(url)));
}

/**
 * @param data Game data object
 * @param filePath Destination JSON file path
 * @param lastUpdated Last updated UNIX timestamp, defaults to current time
 */
export async function writeJsonData(
  data: GameData,
  filePath: string,
  lastUpdated: number | undefined = undefined,
) {
  data.meta.lastUpdated = lastUpdated ?? Date.now();
  let formatted;
  try {
    formatted = await format(JSON.stringify(data, null, 2), {
      filepath: filePath,
    });
  } catch (e) {
    throw new Error("Formatting failed", { cause: e });
  }
  return promises.writeFile(filePath, formatted);
}

/** @type {PQueue} */
export let requestQueue: PQueue = new PQueue({
  concurrency: 1, // 6 concurrent max
  interval: 1000,
  intervalCap: 10, // 10 per second max
});
const JACKETS_PATH = resolve(__dirname, "../src/assets/jackets");

/**
 * call in import files where all jacket lookups are being done locally
 * to remove all throttling (originally intended to be more polite to remywiki & al)
 */
export function unlockRequestConcurrency() {
  requestQueue = new PQueue({});
}

let JACKET_PREFIX = "";
export function setJacketPrefix(prefix: string) {
  JACKET_PREFIX = prefix;
}

/**
 * @param coverUrl url of file to be fetched
 * @param localFilename known local filename, or song name
 * @returns absolute and relative paths
 */
function getOutputPath(coverUrl: string, localFilename: string) {
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
    absolute: join(JACKETS_PATH, outputPath) as `${string}.jpg`,
    relative: outputPath.replace(/\\/g, "/"),
  };
}

/** @param absoluteImgPath */
function createParentFolderIfNeeded(absoluteImgPath: string) {
  const base = dirname(absoluteImgPath);
  if (!existsSync(base)) {
    mkdirSync(base, { recursive: true });
  }
}

/**
 * @param coverUrl url of image to fetch
 * @param localFilename override filename found in url
 *
 * queues a cover path for download into the imageQueue.
 * Always skips if file already exists.
 * Immediately returns the relative path to the jacket where it will be saved
 */
export function downloadJacket(
  coverUrl: string,
  localFilename: string | undefined = undefined,
) {
  const { absolute, relative } = getOutputPath(coverUrl, localFilename);
  if (!existsSync(absolute)) {
    createParentFolderIfNeeded(absolute);
    requestQueue
      .add(
        () => {
          console.log("fetching", coverUrl);
          return Jimp.read(coverUrl);
        },
        { throwOnTimeout: true },
      )
      .then((img) =>
        img
          .resize({ w: 128, mode: ResizeStrategy.BILINEAR })
          .write(absolute, { quality: 80 }),
      )
      .catch((e) => {
        console.error("image download failure for", coverUrl);
        e.cause ? console.error(e.cause) : console.error(e);
      });
  }

  return relative;
}

/**
 *
 * @param {string} songName
 * @returns {string|undefined} relative output path if jacket exists
 */
export function checkJacketExists(songName: string): string | undefined {
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

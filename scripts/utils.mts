import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { globalAgent as httpAgent } from "node:http";
import { globalAgent as httpsAgent } from "node:https";
import { resolve, basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "oxfmt";
import PQueue from "p-queue";
import { Jimp, ResizeStrategy } from "jimp";
import sanitize from "sanitize-filename";
import { JSDOM } from "jsdom";
import type { Task } from "tasuku";

const __dirname = dirname(fileURLToPath(import.meta.url));

import CacheableLookup from "cacheable-lookup";

import type { GameData, Song } from "../src/models/SongData.ts";

{
  /* globally install dns caching to avoid mass lookups of remywiki over and over */
  const dnsCache = new CacheableLookup();
  dnsCache.install(httpAgent);
  dnsCache.install(httpsAgent);
}

/**
 * Returns whether a file or folder exists asynchronously
 * @param path file or folder path
 */
export async function exists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * sorts songs in-place, and charts within each song
 * @param songs array of songs to sort
 * @param meta game metadata for sorting charts
 * @param compareFn Optional comparison function for sorting songs (defaults to case-insensitive name sort)
 */
export function sortSongs(
  songs: Song[],
  meta: GameData["meta"],
  compareFn?: (left: Song, right: Song) => number,
): Song[] {
  compareFn ??= (left, right) => {
    const leftLowerName = left.name.toLowerCase();
    const rightLowerName = right.name.toLowerCase();

    if (leftLowerName === rightLowerName) {
      return left.name == right.name ? 0 : left.name > right.name ? 1 : -1;
    }
    return leftLowerName > rightLowerName ? 1 : -1;
  };
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
  return songs.sort(compareFn);
}

/**
 * Fetches and parses a URL into a JSDOM object, using the request queue
 * @param url URL to fetch
 */
export async function getDom(url: string): Promise<JSDOM> {
  return await requestQueue.add(async () => {
    const req = await fetch(url);
    return new JSDOM(await req.text());
  });
}

/** the repo's own oxfmt settings, so written data passes `oxfmt --check` */
const FORMAT_CONFIG: { printWidth?: number } = (() => {
  const { printWidth } = JSON.parse(
    readFileSync(resolve(__dirname, "../.oxfmtrc.json"), "utf-8"),
  );
  return { printWidth };
})();

/**
 * @param data Game data object
 * @param filePath Destination JSON file path
 * @param lastUpdated Last updated UNIX timestamp, defaults to current time
 */
/**
 * A `song.id` for songs whose source has no id of its own: a hash of the name
 * and artist. Computed once, when a song first enters a file, and kept from then
 * on, so later renames don't change it. Being deterministic, the same song gets
 * the same id in every file it's imported into.
 */
export function deriveSongId(name: string, artist: string): string {
  const key = `${name.normalize("NFKC").trim()}\n${artist.normalize("NFKC").trim()}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/**
 * Whether an id is a 3icecream song id, which DDR songs use as their `id`. They
 * are 32 characters from 3icecream's own 16-letter alphabet.
 */
export function isSanbaiId(id: string): boolean {
  return /^[01689DIOPQbdiloq]{32}$/.test(id);
}

/**
 * Folds songs listed more than once (same `id`) into the first listing, with
 * all their charts, since a file lists each song once.
 */
export function mergeSongsById(songs: Song[]): Song[] {
  const byId = new Map<string, Song>();
  for (const song of songs) {
    const prior = byId.get(song.id);
    if (prior) {
      prior.charts.push(...song.charts);
    } else {
      byId.set(song.id, song);
    }
  }
  return [...byId.values()];
}

export async function writeJsonData(
  data: GameData,
  filePath: string,
  lastUpdated: number | undefined = undefined,
  space?: number,
) {
  data.meta.lastUpdated = lastUpdated ?? Date.now();
  try {
    const { code } = await format(
      filePath,
      JSON.stringify(data, null, space),
      FORMAT_CONFIG,
    );
    return writeFile(filePath, code);
  } catch (e) {
    throw new Error("Formatting failed", { cause: e });
  }
}

/** @type {PQueue} */
export let requestQueue: PQueue = new PQueue({
  concurrency: 6, // 6 concurrent max
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
function getOutputPath(coverUrl: string, localFilename: string | undefined) {
  if (!localFilename) {
    localFilename = JACKET_PREFIX + basename(coverUrl);
  } else {
    localFilename = JACKET_PREFIX + localFilename;
  }
  if (!localFilename.endsWith(".jpg")) {
    localFilename += ".jpg";
  }
  const sanitizedFilename = sanitize(basename(localFilename))
    .replaceAll("#", "")
    .replaceAll("+", " ");
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

/** an image that reads its own bytes, e.g. one inside a zip archive */
interface ImageSource {
  /** the image's own filename, used only for logging */
  name: string;
  file(): Promise<File>;
}

/** width all jackets are downscaled to */
export const JACKET_WIDTH = 128;

/**
 * Downscales and compresses a jacket to the project's standard size and quality
 * @param img decoded source image
 * @param absolute output path
 */
export function writeJacket(
  img: Awaited<ReturnType<typeof Jimp.read>>,
  absolute: `${string}.jpg`,
) {
  return img
    .resize({ w: JACKET_WIDTH, mode: ResizeStrategy.BILINEAR })
    .write(absolute, { quality: 80 });
}

/**
 * Queues a cover image for download into the imageQueue.
 * Always skips if file already exists.
 * Immediately returns the relative path to the jacket where it will be saved
 * @param source url/path of image to fetch, or an image that reads its own
 * bytes, such as one inside a zip archive
 * @param localFilename override filename found in url
 */
export function downloadJacket(
  source: string | ImageSource,
  localFilename: string | undefined = undefined,
) {
  const label = typeof source === "string" ? source : source.name;
  const { absolute, relative } = getOutputPath(label, localFilename);
  if (!existsSync(absolute)) {
    createParentFolderIfNeeded(absolute);
    requestQueue
      .add(async () => {
        if (typeof source === "string") {
          console.log("fetching", source);
          return Jimp.read(source);
        }
        // already local, so read it straight out of the folder or archive
        return Jimp.fromBuffer(await (await source.file()).arrayBuffer());
      })
      .then((img) => writeJacket(img, absolute))
      .catch((e) => {
        console.error("image download failure for", label);
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

export function reportQueueStatusLive(task: Task) {
  const outerController = new AbortController();
  task("Request Queue", ({ setStatus }) => {
    const controller = new AbortController();
    requestQueue
      .on("add", () => {
        setStatus(queueStatus());
      })
      .on("active", () => {
        setStatus(queueStatus());
      })
      .on("next", () => {
        jobCount++;
        setStatus(queueStatus());
      })
      .on("idle", () => {
        setStatus("Empty");
        if (outerController.signal.aborted) {
          controller.abort();
        }
      });

    outerController.signal.addEventListener("abort", () => {
      if (!requestQueue.size && !requestQueue.pending) {
        controller.abort();
      }
    });

    return new Promise<void>((resolve, reject) => {
      controller.signal.addEventListener("abort", () => resolve());
    });
  });
  return () => outerController.abort();
}

function queueStatus() {
  return `Requests in flight: ${requestQueue.pending} Requests Waiting: ${requestQueue.size} Jobs done: ${jobCount}`;
}

/** Interface for importing songs from a source */
export interface SongImporter<T extends Partial<Song>> {
  /** Fetches songs from the source */
  fetchSongs(): Promise<T[]>;

  /**
   * Compares two song objects for equality
   * @param existingSong Existing song in the database
   * @param fetchedSong Newly fetched song from the source
   * @returns True if songs are considered equal
   */
  songEquals(existingSong: Song, fetchedSong: T): boolean;

  /**
   * Merges data from an `fetchedSong` into `existingSong` object.
   * @summary This function with side effects that change `existingSong` object
   * @param existingSong Existing song object to update
   * @param fetchedSong Newly fetched song from the source
   * @returns True if the merge resulted in any updates
   */
  merge(existingSong: Song, fetchedSong: T): boolean | Promise<boolean>;
}

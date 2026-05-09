#!/usr/bin/env node
// @ts-check

/**
 * Script to import Ongeki song data from SEGA's public music API,
 * augmented with granular internal levels scraped from ongeki-score.net.
 *
 * ongeki-score.net may block overseas access with CAPTCHA; set the env var
 * ONGEKI_SCORE_USER_AGENT to a whitelisted UA to bypass it (see the site's
 * data policy: https://ongeki-score.net/data-policy).
 * If the fetch fails, internal levels fall back to the "13+" → 13.7 heuristic.
 */

import { resolve, dirname } from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
import task from "tasuku";
import {
  downloadJacket,
  reportQueueStatusLive,
  requestQueue,
  writeJsonData,
} from "./utils.mts";
import type { Chart, GameData, Song } from "../src/models/SongData.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GET_IMAGES = true;

const DATA_URL = "https://ongeki.sega.jp/assets/json/music/music.json";
const INTERNAL_LEVELS_URL = "https://ongeki-score.net/music";
const IMAGE_BASE_URL = "https://ongeki-net.com/ongeki-mobile/img/music/";
const OUTPUT_PATH = resolve(__dirname, "../src/songs/ongeki.json");

const VERSIONS: { date: string; name: string }[] = [
  { date: "20250327", name: "Re:Fresh" },
  { date: "20220303", name: "bright MEMORY" },
  { date: "20211021", name: "bright" },
  { date: "20210331", name: "R.E.D. PLUS" },
  { date: "20200930", name: "R.E.D." },
  { date: "20200220", name: "SUMMER PLUS" },
  { date: "20190822", name: "SUMMER" },
  { date: "20190207", name: "オンゲキ PLUS" },
  { date: "20180726", name: "オンゲキ" },
];

const DIFF_NAME_MAP: Record<string, string> = {
  Basic: "basic",
  Advanced: "advanced",
  Expert: "expert",
  Master: "master",
  Lunatic: "lunatic",
};

// Key used to look up internal levels: "title|diffClass"
type InternalLevelKey = string;
function internalLevelKey(title: string, diffClass: string): InternalLevelKey {
  return `${title}|${diffClass}`;
}

/**
 * Fetches the ongeki-score.net music page HTML, routing through a FlareSolverr
 * instance (FLARESOLVERR_URL env var) when set to bypass Cloudflare. Falls back
 * to a direct fetch, which may work with ONGEKI_SCORE_USER_AGENT set.
 */
async function fetchInternalLevelsHtml(): Promise<string> {
  const flareSolverrUrl = process.env.FLARESOLVERR_URL;
  if (flareSolverrUrl) {
    const res = await fetch(`${flareSolverrUrl}/v1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url: INTERNAL_LEVELS_URL,
        maxTimeout: 60000,
      }),
    });
    if (!res.ok) {
      throw new Error(`FlareSolverr returned ${res.status} ${res.statusText}`);
    }
    const data: any = await res.json();
    if (data.status !== "ok") {
      throw new Error(`FlareSolverr error: ${data.message ?? data.status}`);
    }
    return data.solution.response as string;
  }

  const headers: Record<string, string> = {};
  if (process.env.ONGEKI_SCORE_USER_AGENT) {
    headers["User-Agent"] = process.env.ONGEKI_SCORE_USER_AGENT;
  }
  const response = await fetch(INTERNAL_LEVELS_URL, { headers });
  if (!response.ok) {
    throw new Error(
      `ongeki-score.net returned ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
}

/**
 * Scrapes ongeki-score.net for confirmed decimal internal levels.
 * Returns a map of "title|diffClass" → internal level number.
 * Estimated (unconfirmed) entries are omitted so callers can fall back to
 * the "+" heuristic.
 */
async function fetchInternalLevels(): Promise<Map<InternalLevelKey, number>> {
  const html = await fetchInternalLevelsHtml();
  const { window } = new JSDOM(html);
  const { document } = window;

  const rows = document.querySelectorAll(
    "#sort_table > table > tbody > tr",
  );

  const levels = new Map<InternalLevelKey, number>();

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 4) continue;

    const title = cells[0].querySelector("a")?.textContent ?? "";
    const diffName = cells[1].textContent?.trim() ?? "";
    const diffClass = DIFF_NAME_MAP[diffName];
    if (!diffClass || !title) continue;

    const levelCell = cells[3];
    const isEstimated = levelCell.querySelector(".estimated-rating") !== null;
    if (isEstimated) continue;

    const levelValue = parseFloat(levelCell.textContent ?? "");
    if (isNaN(levelValue)) continue;

    levels.set(internalLevelKey(title, diffClass), levelValue);
  }

  return levels;
}

function getVersionFolder(dateStr: string): string {
  for (const v of VERSIONS) {
    if (dateStr >= v.date) return v.name;
  }
  return "オンゲキ";
}

/** Converts SEGA API level strings ("13", "13+") to a number, using the
 * community-confirmed internal level when available. Falls back to replacing
 * "+" with ".7" as a rough heuristic (e.g. "13+" → 13.7). */
function resolveLevel(
  rawLevel: string,
  title: string,
  diffClass: string,
  internalLevels: Map<InternalLevelKey, number>,
): number | null {
  if (!rawLevel) return null;
  const confirmed = internalLevels.get(internalLevelKey(title, diffClass));
  if (confirmed !== undefined) return confirmed;
  return Number(rawLevel.replace("+", ".7"));
}

function localJacketPath(imageUrl: string): string {
  return `ongeki/${imageUrl.replace(/\.png$/, ".jpg")}`;
}

function extractSong(
  rawSong: Record<string, any>,
  existingSong: Song | undefined,
  internalLevels: Map<InternalLevelKey, number>,
): Song {
  const isLunaticOnly = !!rawSong.lunatic;
  const title: string = rawSong.title;

  const charts: Chart[] = (
    [
      { key: "lev_bas", diffClass: "basic" },
      { key: "lev_adv", diffClass: "advanced" },
      { key: "lev_exc", diffClass: "expert" },
      { key: "lev_mas", diffClass: "master" },
      { key: "lev_lnt", diffClass: "lunatic" },
    ] as const
  )
    .filter(({ key }) => !!rawSong[key])
    .map(({ key, diffClass }) => ({
      style: "single",
      diffClass,
      lvl: resolveLevel(rawSong[key], title, diffClass, internalLevels)!,
    }));

  const jacketFilename = localJacketPath(rawSong.image_url);
  if (GET_IMAGES) {
    downloadJacket(`${IMAGE_BASE_URL}${rawSong.image_url}`, jacketFilename);
  }

  return {
    ...existingSong,
    name: title,
    artist: rawSong.artist,
    bpm: existingSong?.bpm ?? "?",
    jacket: jacketFilename,
    folder: getVersionFolder(rawSong.date),
    date_added: `${rawSong.date.substring(0, 4)}-${rawSong.date.substring(4, 6)}-${rawSong.date.substring(6, 8)}`,
    ...(isLunaticOnly ? { flags: ["lun_only"] } : {}),
    charts,
  };
}

const baseGameData: GameData = {
  $schema: "../../songs.schema.json",
  meta: {
    lastUpdated: 0,
    menuParent: "more",
    styles: ["single"],
    difficulties: [
      { key: "basic", color: "#16ff47" },
      { key: "advanced", color: "#ffba00" },
      { key: "expert", color: "#fa0667" },
      { key: "master", color: "#a810ff" },
      { key: "lunatic", color: "#dee600" },
    ],
    folders: [
      "オンゲキ",
      "オンゲキ PLUS",
      "SUMMER",
      "SUMMER PLUS",
      "R.E.D.",
      "R.E.D. PLUS",
      "bright",
      "bright MEMORY",
      "Re:Fresh",
    ],
    flags: ["lun_only"],
  },
  defaults: {
    style: "single",
    difficulties: ["expert", "master"],
    flags: [],
    lowerLvlBound: 12,
    upperLvlBound: 15,
  },
  i18n: {
    en: {
      name: "Ongeki",
      single: "Single",
      basic: "BASIC",
      advanced: "ADVANCED",
      expert: "EXPERT",
      master: "MASTER",
      lunatic: "LUNATIC",
      lun_only: "Lunatic Mode Songs",
      $abbr: {
        basic: "BAS",
        advanced: "ADV",
        expert: "EXP",
        master: "MAS",
        lunatic: "LUN",
      },
    },
    ja: {
      name: "オンゲキ",
      single: "Single",
      basic: "BASIC",
      advanced: "ADVANCED",
      expert: "EXPERT",
      master: "MASTER",
      lunatic: "LUNATIC",
      lun_only: "ルナティックモード楽曲",
      $abbr: {
        basic: "BAS",
        advanced: "ADV",
        expert: "EXP",
        master: "MAS",
        lunatic: "LUN",
      },
    },
  },
  songs: [],
};

task("Ongeki Import", async ({ setStatus, setError, task: subTask }) => {
  const cleanup = reportQueueStatusLive(subTask);
  try {
    const existingData: GameData = JSON.parse(
      await readFile(OUTPUT_PATH, { encoding: "utf-8" }),
    );
    const existingSongsById: Record<string, Song> = {};
    for (const song of existingData.songs) {
      existingSongsById[song.name] = song;
    }

    setStatus("Fetching song data from SEGA API...");
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch SEGA API: ${response.status} ${response.statusText}`,
      );
    }
    const rawSongs: Record<string, any>[] = await response.json();
    setStatus(`Fetched ${rawSongs.length} songs from SEGA`);

    setStatus("Fetching internal levels from ongeki-score.net...");
    let internalLevels = new Map<InternalLevelKey, number>();
    try {
      internalLevels = await fetchInternalLevels();
      setStatus(`Fetched ${internalLevels.size} confirmed internal levels`);
    } catch (e) {
      console.warn(
        `\nWarning: could not fetch internal levels (${(e as Error).message}). ` +
          `Falling back to "+" heuristic for all levels.\n`,
      );
    }

    const songs: Song[] = rawSongs.map((rawSong) =>
      extractSong(rawSong, existingSongsById[rawSong.title], internalLevels),
    );

    const outputData: GameData = {
      ...baseGameData,
      ...existingData,
      meta: { ...baseGameData.meta, lastUpdated: 0 },
      songs,
    };

    setStatus("Writing JSON output...");
    await writeJsonData(outputData, OUTPUT_PATH);

    if (requestQueue.size || requestQueue.pending) {
      setStatus("Waiting for image downloads to finish...");
      await requestQueue.onIdle();
    }
    setStatus("Done!");
  } catch (e) {
    setError(e as Error);
  } finally {
    cleanup();
  }
});

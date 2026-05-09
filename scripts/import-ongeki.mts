#!/usr/bin/env node
// @ts-check

/**
 * Script to import Ongeki song data from SEGA's public music API
 */

import { resolve, dirname } from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
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

function getVersionFolder(dateStr: string): string {
  for (const v of VERSIONS) {
    if (dateStr >= v.date) return v.name;
  }
  return "オンゲキ";
}

function parseLevel(levelStr: string): number | null {
  if (!levelStr) return null;
  return Number(levelStr.replace("+", ".7"));
}

function localJacketPath(imageUrl: string): string {
  const filename = imageUrl.replace(/\.png$/, ".jpg");
  return `ongeki/${filename}`;
}

function extractSong(
  rawSong: Record<string, any>,
  existingSong: Song | undefined,
): Song {
  const isLunaticOnly = !!rawSong.lunatic;

  const charts: Chart[] = [
    { key: "lev_bas", diffClass: "basic" },
    { key: "lev_adv", diffClass: "advanced" },
    { key: "lev_exc", diffClass: "expert" },
    { key: "lev_mas", diffClass: "master" },
    { key: "lev_lnt", diffClass: "lunatic" },
  ]
    .filter(({ key }) => !!rawSong[key])
    .map(({ key, diffClass }) => ({
      style: "single",
      diffClass,
      lvl: parseLevel(rawSong[key])!,
    }));

  const jacketFilename = localJacketPath(rawSong.image_url);
  if (GET_IMAGES) {
    downloadJacket(`${IMAGE_BASE_URL}${rawSong.image_url}`, jacketFilename);
  }

  return {
    ...existingSong,
    name: rawSong.title,
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
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const rawSongs: Record<string, any>[] = await response.json();
    setStatus(`Fetched ${rawSongs.length} songs`);

    const songs: Song[] = rawSongs.map((rawSong) => {
      const existing = existingSongsById[rawSong.title];
      return extractSong(rawSong, existing);
    });

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

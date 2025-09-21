/**
 * Import DDR series song data from various sources and merge into existing data file.
 * Usage: `node --experimental-strip-types scripts/import-ddr.mts`
 * (Note: This script is registered in npm script, so you can also call it with `yarn import:ddr`)
 *
 * If you want to import a different series (ex. DDR EXTREME), change the `MIX_META` import from `./scraping/ddr-sources.mts`.
 */
import * as path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

import type { GameData, Song } from "../src/models/SongData.ts";
import {
  writeJsonData,
  requestQueue,
  sortSongs,
  setJacketPrefix,
  downloadJacket,
} from "./utils.mjs";
import { DDR_WORLD as MIX_META } from "./scraping/ddr-sources.mts";
import { EAGateSongImporter } from "./scraping/eagate.mjs";
import {
  guessUrlFromName,
  getJacketFromRemySong,
  getMetaFromRemy,
} from "./scraping/remy.mjs";
import { SanbaiSongImporter } from "./scraping/sanbai.mjs";
import { ZivSongImporter } from "./scraping/ziv.mjs";

setJacketPrefix(MIX_META.jacketPrefix);

/** Already fetched from RemyWiki */
const alreadyFetched: Set<string> = new Set();
/**
 * Try to get song meta data from RemyWiki if missing
 * @param song Song to get meta for
 * @returns whether any meta was added
 */
async function tryGetMetaFromRemy(
  song: Pick<Song, "name"> &
    Partial<Pick<Song, "remyLink" | "jacket" | "bpm" | "artist">>,
): Promise<boolean> {
  if ((song.remyLink && song.jacket) || alreadyFetched.has(song.name))
    return false;

  // Try to guess remyLink from name only once
  alreadyFetched.add(song.name);
  song.remyLink ||= await guessUrlFromName(song.name);
  if (!song.remyLink) return false;

  console.log(`Added "${song.name}" remyLink: ${song.remyLink}`);

  // Try to get jacket from remyLink
  if (!song.jacket && song.remyLink) {
    const jacket = await getJacketFromRemySong(song.remyLink, song.name);
    if (jacket) {
      song.jacket = jacket;
      console.log(`Added "${song.name}" jacket from remyLink: ${jacket}`);
    }
  }
  if (!song.bpm || !song.artist) {
    const meta = await getMetaFromRemy(song.remyLink);
    if (!song.bpm && meta?.bpm) {
      song.bpm = meta.bpm;
      console.log(`Added "${song.name}" bpm from remyLink: ${meta.bpm}`);
    }
    if (!song.artist && meta?.artist) {
      song.artist = meta.artist;
      console.log(`Added "${song.name}" artist from remyLink: ${meta.artist}`);
    }
  }
  return true;
}

try {
  const targetFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/songs",
    MIX_META.filename,
  );

  const existingData: GameData = JSON.parse(
    await readFile(targetFile, { encoding: "utf-8" }),
  );

  if (MIX_META.eagate) {
    console.log("Fetching songs from e-amusement GATE...");
    const importer = new EAGateSongImporter(
      MIX_META.eagate.songList,
      MIX_META.eagate.jacket,
    );
    const fetchedSongs = await importer.fetchSongs();

    console.log(`Fetched ${fetchedSongs.length} songs from DDR World`);

    const tasks = fetchedSongs.map(
      async (worldSong: (typeof fetchedSongs)[number] & Partial<Song>) => {
        // Find existing song by saHash
        const existingSong = existingData.songs.find((s) =>
          EAGateSongImporter.songEquals(s, worldSong),
        );

        if (existingSong) {
          // Get remyLink and jacket if missing
          await tryGetMetaFromRemy(existingSong);

          EAGateSongImporter.merge(existingSong, worldSong, [
            "copyStrikes",
            "shock",
          ]);
        } else {
          console.log(`Adding new song: ${worldSong.name}`);

          // Try to get meta data from remyLink
          await tryGetMetaFromRemy(worldSong);

          // If still no jacket, try to get from e-amusement GATE
          if (!worldSong.jacket) {
            worldSong.jacket = downloadJacket(
              worldSong.getJacketUrl(),
              worldSong.name,
            );
          }

          const newSong: Song = {
            name: worldSong.name,
            artist: worldSong.artist || "",
            bpm: worldSong.bpm || "???",
            folder: "DanceDanceRevolution World",
            charts: worldSong.charts,
            remyLink: worldSong.remyLink,
            jacket: worldSong.jacket,
            saHash: worldSong.saHash,
          };

          existingData.songs.push(newSong);
        }
      },
    );
    console.log("Processing all e-amusement GATE songs...");
    await Promise.all(tasks);
    await requestQueue.onIdle();
    console.log(`Songs from e-amusement GATE: ${fetchedSongs.length}`);
  }

  if (MIX_META.sanbai) {
    // Fetch 3icecream data using SanbaiSongImporter
    const importer = new SanbaiSongImporter();
    const fetchedSongs = await importer.fetchSongs();

    // Merge with existing data
    const tasks = fetchedSongs.map(
      async (sanbaiSong: (typeof fetchedSongs)[number] & Partial<Song>) => {
        const existingSong = existingData.songs.find((s) =>
          SanbaiSongImporter.songEquals(s, sanbaiSong),
        );

        // Delete songs that are removed from the game
        if (sanbaiSong.deleted) {
          if (existingSong) {
            console.log(`Deleting removed song: ${existingSong.name}`);
            existingData.songs = existingData.songs.filter(
              (s) => s !== existingSong,
            );
          }
          return;
        }

        if (existingSong) {
          // Get remyLink and jacket if missing
          await tryGetMetaFromRemy(existingSong);

          SanbaiSongImporter.merge(existingSong, sanbaiSong, [
            "copyStrikes",
            "shock",
          ]);
        } else {
          console.log(`Adding new song: ${sanbaiSong.name}`);

          // Try to get meta data from remyLink
          await tryGetMetaFromRemy(sanbaiSong);

          // If still no jacket, try to get from 3icecream
          if (!sanbaiSong.jacket) {
            sanbaiSong.jacket = downloadJacket(
              sanbaiSong.getJacketUrl(),
              sanbaiSong.name,
            );
          }

          existingData.songs.push({
            name: sanbaiSong.name,
            name_translation: sanbaiSong.name_translation,
            artist: sanbaiSong.artist || "???",
            bpm: sanbaiSong.bpm || "???",
            charts: sanbaiSong.charts,
            flags: sanbaiSong.flags,
            jacket: sanbaiSong.jacket,
            remyLink: sanbaiSong.remyLink,
            saHash: sanbaiSong.saHash,
            search_hint: sanbaiSong.search_hint,
          });
        }
      },
    );
    console.log("Processing all 3icecream songs...");
    await Promise.all(tasks);
    await requestQueue.onIdle();
    console.log(
      `Songs from 3icecream (except deleted): ${fetchedSongs.filter((s) => !s.deleted).length}`,
    );
  }

  if (MIX_META.ziv) {
    const importer = new ZivSongImporter(
      MIX_META.ziv.url,
      MIX_META.ziv.difficulties,
      existingData.meta?.folders,
      MIX_META.ziv.correctionMap,
    );
    const fetchedSongs = await importer.fetchSongs();

    const tasks = fetchedSongs.map(
      async (zivSong: (typeof fetchedSongs)[number] & Partial<Song>) => {
        const existingSong = existingData.songs.find((s) =>
          ZivSongImporter.songEquals(s, zivSong),
        );
        if (!existingSong || zivSong.deleted) return; // only merge existing songs
        ZivSongImporter.merge(existingSong, zivSong);
      },
    );
    console.log("Processing all zenius-i-vanisher songs...");
    await Promise.all(tasks);
    await requestQueue.onIdle();
    console.log(`Songs from zenius-i-vanisher: ${fetchedSongs.length}`);
  }

  if (MIX_META.sortSongs) existingData.songs = sortSongs(existingData.songs);

  await writeJsonData(existingData, targetFile);

  console.log(`Successfully updated ${MIX_META.filename}`);
  console.log(`Total songs in database: ${existingData.songs.length}`);
  console.log("Done");
} catch (e) {
  console.error("Error updating DDR World data:", e);
  process.exitCode = 1;
}

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
} from "./utils.mts";
import {
  JsonDDRSongImporter,
  DDR_WORLD as MIX_META,
} from "./scraping/ddr-sources.mts";
import { EAGateSongImporter } from "./scraping/eagate-ddr.mts";
import { tryGetMetaFromRemy } from "./scraping/remy.mts";
import { SanbaiSongImporter } from "./scraping/sanbai.mts";
import { ZivSongImporter } from "./scraping/ziv.mts";

setJacketPrefix(MIX_META.jacketPrefix);

try {
  const targetFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/songs",
    MIX_META.filename,
  );

  const existingData: GameData = JSON.parse(
    await readFile(targetFile, { encoding: "utf-8" }),
  );

  let lastUpdated = Date.now();

  if (MIX_META.eagate) {
    console.log("Fetching songs from e-amusement GATE...");
    const importer = new EAGateSongImporter(
      MIX_META.eagate.songList,
      MIX_META.eagate.jacket,
      MIX_META.unmanagedFlags ?? [],
    );
    const fetchedSongs = await importer.fetchSongs();

    console.log(`Fetched ${fetchedSongs.length} songs from DDR World`);

    const tasks = fetchedSongs.map(
      async (worldSong: (typeof fetchedSongs)[number] & Partial<Song>) => {
        // Find existing song by saHash
        const existingSong = existingData.songs.find((s) =>
          importer.songEquals(s, worldSong),
        );

        if (existingSong) {
          // Get remyLink if missing
          await tryGetMetaFromRemy(existingSong, "DanceDanceRevolution");

          importer.merge(existingSong, worldSong);
        } else {
          console.log(`Adding new song: ${worldSong.name}`);

          // Try to get meta data from remyLink
          await tryGetMetaFromRemy(worldSong, "DanceDanceRevolution");
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
            saHash: worldSong.saHash,
            bpm: worldSong.bpm || "???",
            folder: existingData.meta.folders[0],
            charts: worldSong.charts,
            remyLink: worldSong.remyLink,
            jacket: worldSong.jacket,
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
    const importer = new SanbaiSongImporter(MIX_META.unmanagedFlags ?? []);
    const fetchedSongs = await importer.fetchSongs();

    // Merge with existing data
    const tasks = fetchedSongs.map(
      async (sanbaiSong: (typeof fetchedSongs)[number] & Partial<Song>) => {
        const existingSong = existingData.songs.find((s) =>
          importer.songEquals(s, sanbaiSong),
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
          // Get remyLink if missing
          await tryGetMetaFromRemy(existingSong, "DanceDanceRevolution");

          importer.merge(existingSong, sanbaiSong);
        } else {
          console.log(`Adding new song: ${sanbaiSong.name}`);

          // Try to get meta data from remyLink
          await tryGetMetaFromRemy(sanbaiSong, "DanceDanceRevolution");

          // If no jacket, try to get from 3icecream
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
            saHash: sanbaiSong.saHash,
            bpm: sanbaiSong.bpm || "???",
            folder: sanbaiSong.folder ?? existingData.meta.folders[0],
            charts: sanbaiSong.charts,
            flags: sanbaiSong.flags,
            jacket: sanbaiSong.jacket,
            remyLink: sanbaiSong.remyLink,
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

    // @ts-ignore: This file is dynamic import
    lastUpdated = (
      (await import("./scraping/sanbai/songdata.mjs")) as {
        SONG_DATA_LAST_UPDATED_unixms: number;
      }
    ).SONG_DATA_LAST_UPDATED_unixms;
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
          importer.songEquals(s, zivSong),
        );
        if (!existingSong) return; // only merge existing songs
        importer.merge(existingSong, zivSong);
      },
    );
    console.log("Processing all zenius-i-vanisher songs...");
    await Promise.all(tasks);
    await requestQueue.onIdle();
    console.log(`Songs from zenius-i-vanisher: ${fetchedSongs.length}`);
  }

  if (MIX_META.copyFrom) {
    const importer = new JsonDDRSongImporter(
      MIX_META.copyFrom.file,
      MIX_META.copyFrom.keys,
    );
    const fetchedSongs = await importer.fetchSongs();

    const tasks = fetchedSongs.map(
      async (sourceSong: (typeof fetchedSongs)[number] & Partial<Song>) => {
        const existingSong = existingData.songs.find((s) =>
          importer.songEquals(s, sourceSong),
        );
        if (!existingSong) return; // only merge existing songs
        importer.merge(existingSong, sourceSong);
      },
    );
    console.log(
      `Processing all songs from ${MIX_META.copyFrom.file} to copy properties...`,
    );
    await Promise.all(tasks);
    console.log(
      `Songs processed for property copy from ${MIX_META.copyFrom.file}: ${fetchedSongs.length}`,
    );
  }

  if (MIX_META.sortSongs)
    existingData.songs = sortSongs(existingData.songs, existingData.meta);

  await writeJsonData(existingData, targetFile, lastUpdated, 2);

  console.log(`Successfully updated ${MIX_META.filename}`);
  console.log(`Total songs in database: ${existingData.songs.length}`);
  console.log("Done");
} catch (e) {
  console.error(`Error updating ${MIX_META.filename} data:`, e);
  process.exitCode = 1;
}

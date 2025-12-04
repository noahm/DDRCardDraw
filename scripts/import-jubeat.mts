import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import task from "tasuku";

import {
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
  writeJsonData,
  sortSongs,
} from "./utils.mts";
import { tryGetMetaFromRemy } from "./scraping/remy.mts";
import type { GameData, Song } from "../src/models/SongData.ts";
import { SongImporter } from "./scraping/eagate-jubeat.mts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fileName = "jubeat-beyondave.json";

const licensedSongUrl =
  "https://p.eagate.573.jp/game/jubeat/beyond/music/index.html";
const originalSongUrl =
  "https://p.eagate.573.jp/game/jubeat/beyond/music/original.html";

task("Import Jubeat", async ({ task, setStatus, setError }) => {
  const cleanup = reportQueueStatusLive(task);
  try {
    const targetFile = path.resolve(
      path.join(__dirname, `../src/songs/${fileName}`),
    );

    const existingData: GameData = JSON.parse(
      await readFile(targetFile, { encoding: "utf-8" }),
    );

    // Fetch licensed songs
    console.log("Fetching licensed songs from e-amusement GATE...");
    const licensedImporter = new SongImporter(licensedSongUrl);
    const licensedSongs = await licensedImporter.fetchSongs();
    console.log(
      `Fetched ${licensedSongs.length} licensed songs from e-amusement GATE`,
    );

    // Process licensed songs
    console.log("Processing all licensed songs...");
    for (const fetchedSong of licensedSongs as ((typeof licensedSongs)[number] &
      Partial<Song>)[]) {
      const existingSong = existingData.songs.find((s) =>
        licensedImporter.songEquals(s, fetchedSong),
      );

      if (existingSong) {
        await tryGetMetaFromRemy(existingSong, "Jubeat");
        licensedImporter.merge(existingSong, fetchedSong);
      } else {
        console.log(`Adding new licensed song: ${fetchedSong.name}`);
        await tryGetMetaFromRemy(fetchedSong, "Jubeat");
        const jacket = fetchedSong.jacketUrl
          ? downloadJacket(
              fetchedSong.jacketUrl,
              `jubeat/beyond_the_ave/${fetchedSong.saHash}`,
            )
          : "";

        const newSong: Song = {
          name: fetchedSong.name,
          artist: fetchedSong.artist || "",
          folder: existingData.meta.folders?.at(-1),
          saHash: fetchedSong.saHash,
          bpm: fetchedSong.bpm || "???",
          charts: fetchedSong.charts,
          remyLink: fetchedSong.remyLink,
          jacket,
          flags: ["licensed"],
        };

        existingData.songs.push(newSong);
      }
    }
    await requestQueue.onIdle();
    console.log(
      `Licensed songs from e-amusement GATE: ${licensedSongs.length}`,
    );

    // Fetch original songs
    console.log("Fetching original songs from e-amusement GATE...");
    const originalImporter = new SongImporter(originalSongUrl);
    const originalSongs = await originalImporter.fetchSongs();
    console.log(
      `Fetched ${originalSongs.length} original songs from e-amusement GATE`,
    );

    // Process original songs
    console.log("Processing all original songs...");
    for (const fetchedSong of originalSongs as ((typeof originalSongs)[number] &
      Partial<Song>)[]) {
      const existingSong = existingData.songs.find((s) =>
        originalImporter.songEquals(s, fetchedSong),
      );

      if (existingSong) {
        await tryGetMetaFromRemy(existingSong, "Jubeat");
        originalImporter.merge(existingSong, fetchedSong);
      } else {
        console.log(`Adding new original song: ${fetchedSong.name}`);
        await tryGetMetaFromRemy(fetchedSong, "Jubeat");
        const jacket = fetchedSong.jacketUrl
          ? downloadJacket(
              fetchedSong.jacketUrl,
              `jubeat/beyond_the_ave/${fetchedSong.saHash}`,
            )
          : "";

        const newSong: Song = {
          name: fetchedSong.name,
          artist: fetchedSong.artist || "",
          folder: existingData.meta.folders?.at(-1),
          saHash: fetchedSong.saHash,
          bpm: fetchedSong.bpm || "???",
          charts: fetchedSong.charts,
          remyLink: fetchedSong.remyLink,
          jacket,
        };

        existingData.songs.push(newSong);
      }
    }
    await requestQueue.onIdle();
    console.log(
      `Original songs from e-amusement GATE: ${originalSongs.length}`,
    );

    // Sort songs
    existingData.songs = sortSongs(existingData.songs, existingData.meta);
    await writeJsonData(existingData, targetFile);

    console.log(`Successfully updated ${fileName}.json`);
    console.log(`Total songs in database: ${existingData.songs.length}`);
    setStatus("Done");
  } catch (e) {
    setError(e);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
});

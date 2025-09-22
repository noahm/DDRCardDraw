import * as path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

import { EAGateSongImporter } from "./scraping/eagate.mjs";
import { DDR_WORLD as MIX_META } from "./scraping/ddr-sources.mjs";
import {
  guessUrlFromName,
  getJacketFromRemySong,
  getMetaFromRemy,
} from "./scraping/remy.mjs";
import { SanbaiSongImporter } from "./scraping/sanbai.mjs";
import {
  writeJsonData,
  requestQueue,
  checkJacketExists,
  sortSongs,
  setJacketPrefix,
  downloadJacket,
} from "./utils.mjs";

setJacketPrefix(MIX_META.jacketPrefix);

try {
  const targetFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/songs",
    MIX_META.filename,
  );

  /** @type {import('../src/models/SongData.js').GameData} */
  const existingData = JSON.parse(
    await readFile(targetFile, { encoding: "utf-8" }),
  );

  console.log("Fetching songs from e-amusement GATE...");
  const songListUrl =
    "https://p.eagate.573.jp/game/ddr/ddrworld/music/index.html?filter=7";
  const jacketUrl =
    "https://p.eagate.573.jp/game/ddr/ddrworld/images/binary_jk.html?kind=1";
  const eagateImporter = new EAGateSongImporter(songListUrl, jacketUrl);
  const ddrWorldSongs = await eagateImporter.fetchSongs();

  console.log(`Fetched ${ddrWorldSongs.length} songs from DDR World`);

  const eagateTasks = ddrWorldSongs.map(async (worldSong) => {
    // Find existing song by saHash
    const existingSong = existingData.songs.find((s) =>
      EAGateSongImporter.songEquals(s, worldSong),
    );

    if (existingSong) {
      // Fill remyLink
      if (!existingSong.remyLink) {
        const remyLink = await guessUrlFromName(existingSong.name);
        if (remyLink) {
          existingSong.remyLink = remyLink;
          console.log(`Added "${existingSong.name}" remyLink: ${remyLink}`);
        }
      }

      // Try to get jacket from remyLink
      if (!existingSong.jacket && existingSong.remyLink) {
        const jacket = await getJacketFromRemySong(
          existingSong.remyLink,
          existingSong.name,
        );
        if (jacket) {
          existingSong.jacket = jacket;
          console.log(
            `Added "${existingSong.name}" jacket from remyLink: ${jacket}`,
          );
        }
      }

      EAGateSongImporter.merge(existingSong, worldSong, [
        "copyStrikes",
        "shock",
      ]);
    } else {
      // Add new song
      console.log(`Adding new song: ${worldSong.name}`);

      let jacket = "";

      // Try to get jacket from remyLink if not already exists
      const remyLink = await guessUrlFromName(worldSong.name);
      if (remyLink) {
        jacket = await getJacketFromRemySong(remyLink, worldSong.name);
      }

      // If still no jacket, try to get from DDR World using saHash
      if (!jacket) {
        jacket = downloadJacket(worldSong.getJacketUrl(), worldSong.name);
      }

      const meta = remyLink ? await getMetaFromRemy(remyLink) : {};

      /** @type {import('../src/models/SongData.js').Song} */
      const newSong = {
        name: worldSong.name,
        artist: worldSong.artist || "",
        bpm: meta.bpm || "???",
        folder: "DanceDanceRevolution World",
        charts: worldSong.charts,
        remyLink,
        jacket,
        saHash: worldSong.saHash,
      };

      existingData.songs.push(newSong);
    }
  });
  console.log("Processing all e-amusement GATE songs...");
  await Promise.all(eagateTasks);
  await requestQueue.onIdle();

  // Fetch 3icecream data using SanbaiSongImporter
  const sanbaiImporter = new SanbaiSongImporter();
  const sanbaiSongs = await sanbaiImporter.fetchSongs();

  // Merge with existing data
  const sanbaiTasks = sanbaiSongs.map(async (sanbaiSong) => {
    const existingSong = existingData.songs.find(
      (s) => s.saHash === sanbaiSong.saHash || s.name === sanbaiSong.name,
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
      // Fill remyLink
      if (!existingSong.remyLink) {
        const remyLink = await guessUrlFromName(existingSong.name);
        if (remyLink) {
          existingSong.remyLink = remyLink;
          console.log(`Added "${existingSong.name}" remyLink: ${remyLink}`);
        }
      }

      // Try to get jacket from remyLink
      if (!existingSong.jacket && existingSong.remyLink) {
        const jacket = await getJacketFromRemySong(
          existingSong.remyLink,
          existingSong.name,
        );
        if (jacket) {
          existingSong.jacket = jacket;
          console.log(
            `Added "${existingSong.name}" jacket from remyLink: ${jacket}`,
          );
        }
      }

      SanbaiSongImporter.merge(existingSong, sanbaiSong, [
        "copyStrikes",
        "shock",
      ]);
    } else {
      // insert new song (need to find jacket, bpm, folder, etc)
      console.log(`Adding new song: ${sanbaiSong.name}`);
      const remyLink = await guessUrlFromName(sanbaiSong.name);
      console.log("guessed url as " + (remyLink || "null"));
      let jacket = checkJacketExists(sanbaiSong.name);
      if (remyLink && !jacket) {
        jacket = await getJacketFromRemySong(remyLink, sanbaiSong.name);
      }
      if (!jacket) {
        jacket = downloadJacket(sanbaiSong.getJacketUrl(), sanbaiSong.name);
      }
      const meta = remyLink
        ? await getMetaFromRemy(remyLink)
        : { artist: null, bpm: null };
      existingData.songs.push({
        name: sanbaiSong.name,
        name_translation: sanbaiSong.name_translation,
        artist: meta.artist || "???",
        bpm: meta.bpm || "???",
        charts: sanbaiSong.charts,
        flags: sanbaiSong.flags,
        jacket,
        remyLink,
        saHash: sanbaiSong.saHash,
        search_hint: sanbaiSong.search_hint,
      });
    }
  });
  console.log("Processing all 3icecream songs...");
  await Promise.all(sanbaiTasks);
  await requestQueue.onIdle();

  existingData.songs = sortSongs(existingData.songs);

  await writeJsonData(existingData, targetFile);

  console.log(`Successfully updated ${MIX_META.filename}`);
  console.log(`Total songs in database: ${existingData.songs.length}`);
  console.log(`Songs from e-amusement GATE: ${ddrWorldSongs.length}`);
  console.log(
    `Songs from 3icecream (except deleted): ${sanbaiSongs.filter((s) => !s.deleted).length}`,
  );
  console.log("Done");
} catch (e) {
  console.error("Error updating DDR World data:", e);
  process.exitCode = 1;
}

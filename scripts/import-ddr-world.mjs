import { EAGateSongImporter } from "./scraping/ddr-world.mjs";
import { DDR_WORLD as MIX_META } from "./scraping/ddr-sources.mjs";
import * as path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import {
  writeJsonData,
  requestQueue,
  checkJacketExists,
  sortSongs,
  setJacketPrefix,
  downloadJacket,
} from "./utils.mjs";
import {
  guessUrlFromName,
  getJacketFromRemySong,
  getMetaFromRemy,
} from "./scraping/remy.mjs";

setJacketPrefix(MIX_META.jacketPrefix);

try {
  const targetFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/songs",
    MIX_META.filename,
  );

  /**
   * @type {import('../src/models/SongData.js').GameData}
   */
  const existingData = JSON.parse(
    await readFile(targetFile, { encoding: "utf-8" }),
  );

  console.log("Fetching songs from DDR World...");
  const songListUrl =
    "https://p.eagate.573.jp/game/ddr/ddrworld/music/index.html?filter=7";
  const jacketUrl =
    "https://p.eagate.573.jp/game/ddr/ddrworld/images/binary_jk.html?kind=1";
  const importer = new EAGateSongImporter(songListUrl, jacketUrl);
  const ddrWorldSongs = await importer.fetchSongs();

  console.log(`Fetched ${ddrWorldSongs.length} songs from DDR World`);

  const tasks = ddrWorldSongs.map(async (worldSong) => {
    // Find existing song by saHash
    const existingSong = existingData.songs.find(
      (s) => s.saHash === worldSong.saHash,
    );

    if (existingSong) {
      // Track if any updates were made
      let hasUpdates = false;

      // Update name if different (prefer DDR World notation)
      if (existingSong.name !== worldSong.name) {
        console.log(
          `Updating song name: "${existingSong.name}" -> "${worldSong.name}"`,
        );
        existingSong.name = worldSong.name;
        hasUpdates = true;
      }

      // Update artist (prefer DDR World notation)
      if (existingSong.artist !== worldSong.artist) {
        console.log(
          `Updating artist for ${worldSong.name}: "${existingSong.artist}" -> "${worldSong.artist}"`,
        );
        existingSong.artist = worldSong.artist;
        hasUpdates = true;
      }

      // Update charts - merge with existing charts, prefer DDR World data for lvl
      for (const worldChart of worldSong.charts) {
        const existingChart = existingSong.charts.find(
          (chart) =>
            chart.style === worldChart.style &&
            chart.diffClass === worldChart.diffClass,
        );

        if (existingChart) {
          // Update level if different
          if (existingChart.lvl !== worldChart.lvl) {
            console.log(
              `Updating ${worldSong.name} ${worldChart.style} ${worldChart.diffClass}: ${existingChart.lvl} -> ${worldChart.lvl}`,
            );
            existingChart.lvl = worldChart.lvl;
            hasUpdates = true;
          }
        } else {
          // Add missing chart
          console.log(
            `Adding missing chart for ${worldSong.name}: ${worldChart.style} ${worldChart.diffClass} Lv.${worldChart.lvl}`,
          );
          existingSong.charts.push({ ...worldChart });
          hasUpdates = true;
        }
      }

      // Ensure jacket property exists - try multiple sources
      if (!existingSong.jacket) {
        // First check if remyLink exists, if not try to get it
        if (!existingSong.remyLink) {
          const remyLink = await guessUrlFromName(existingSong.name);
          if (remyLink) {
            existingSong.remyLink = remyLink;
            console.log(`Set remyLink for ${existingSong.name}: ${remyLink}`);
            hasUpdates = true;
          }
        }

        // Try to get jacket from remyLink first
        if (existingSong.remyLink) {
          const jacket = await getJacketFromRemySong(
            existingSong.remyLink,
            existingSong.name,
          );
          if (jacket) {
            existingSong.jacket = jacket;
            console.log(
              `Set jacket from remyLink for ${existingSong.name}: ${jacket}`,
            );
            hasUpdates = true;
          }
        }

        // If still no jacket, try to get from DDR World using saHash
        if (!existingSong.jacket && worldSong.saHash) {
          const jacket = downloadJacket(
            importer.getJacketUrl(worldSong.saHash),
            existingSong.name,
          );
          if (jacket) {
            existingSong.jacket = jacket;
            console.log(
              `Set jacket from DDR World for ${existingSong.name}: ${jacket}`,
            );
            hasUpdates = true;
          }
        }
      }

      // Remove unlock-related flags (except copyStrikes) since DDR World songs are playable
      if (existingSong.flags && Array.isArray(existingSong.flags)) {
        const flagsToRemove = existingSong.flags.filter(
          (flag) => flag !== "copyStrikes",
        );
        if (flagsToRemove.length > 0) {
          existingSong.flags = existingSong.flags.filter(
            (flag) => flag === "copyStrikes",
          );
          if (existingSong.flags.length === 0) {
            delete existingSong.flags;
          }
          console.log(
            `Removed unlock flags for ${worldSong.name}: ${flagsToRemove.join(", ")}`,
          );
          hasUpdates = true;
        }
      }

      // Only log summary if there were actual updates
      if (hasUpdates) {
        console.log(`Updated existing song: ${worldSong.name}`);
      }
    } else {
      // Add new song
      console.log(`Adding new song: ${worldSong.name}`);

      const remyLink = await guessUrlFromName(worldSong.name);
      let jacket = checkJacketExists(worldSong.name);

      // Try to get jacket from remyLink if not already exists
      if (remyLink && !jacket) {
        jacket = await getJacketFromRemySong(remyLink, worldSong.name);
      }

      // If still no jacket, try to get from DDR World using saHash
      if (!jacket && worldSong.saHash) {
        jacket = downloadJacket(
          importer.getJacketUrl(worldSong.saHash),
          worldSong.name,
        );
      }

      const meta = remyLink ? await getMetaFromRemy(remyLink) : {};

      /** @type {import('../src/models/SongData.js').Song} */
      const newSong = {
        name: worldSong.name,
        artist: worldSong.artist || meta.artist || "???",
        bpm: meta.bpm || "???",
        folder: "DanceDanceRevolution World",
        charts: worldSong.charts.map((chart) => ({ ...chart })),
        remyLink,
        jacket,
        saHash: worldSong.saHash,
      };

      existingData.songs.push(newSong);
    }
  });

  console.log("Processing all songs...");
  await Promise.all(tasks);
  await requestQueue.onIdle();

  existingData.songs = sortSongs(existingData.songs);

  await writeJsonData(existingData, targetFile);

  console.log(`Successfully updated ${MIX_META.filename}`);
  console.log(`Total songs in database: ${existingData.songs.length}`);
  console.log(`Songs from DDR World: ${ddrWorldSongs.length}`);
  console.log("Done");
} catch (e) {
  console.error("Error updating DDR World data:", e);
  process.exitCode = 1;
}

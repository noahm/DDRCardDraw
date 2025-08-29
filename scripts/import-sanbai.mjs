import {
  guessUrlFromName,
  getJacketFromRemySong,
  getMetaFromRemy,
} from "./scraping/remy.mjs";
import { SanbaiSongImporter } from "./scraping/sanbai.mjs";
import { DDR_WORLD as MIX_META } from "./scraping/ddr-sources.mjs";
import path from "path";
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

setJacketPrefix(MIX_META.jacketPrefix);
const manualyAddFlags = new Set(["copyStrikes"]);

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

  // Fetch 3icecream data using SanbaiSongImporter
  const importer = new SanbaiSongImporter();
  const sanbaiSongs = await importer.fetchSongs();

  // Merge with existing data
  const tasks = sanbaiSongs.map(async (sanbaiSong) => {
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
      // add missing id
      if (!existingSong.saHash) {
        existingSong.saHash = sanbaiSong.saHash;
      }
      // update charts/flags
      for (const chart of sanbaiSong.charts) {
        const existingChart = existingSong.charts.find(
          (c) => c.style === chart.style && c.diffClass === chart.diffClass,
        );
        if (!existingChart) {
          console.log(
            `Adding missing ${chart.diffClass} chart of ${sanbaiSong.name}`,
          );
          existingSong.charts.push(chart);
          continue;
        }
        if (existingChart.lvl !== chart.lvl) {
          console.log(
            `Updating lvl of ${sanbaiSong.name} ${chart.diffClass}: ${existingChart.lvl} -> ${chart.lvl}`,
          );
          existingChart.lvl = chart.lvl;
        }
        if (chart.sanbaiTier && chart.sanbaiTier !== existingChart.sanbaiTier) {
          existingChart.sanbaiTier = chart.sanbaiTier;
        }

        // Update chart flags
        const meaningfulChartFlags = (existingChart.flags ?? []).filter(
          (f) => !manualyAddFlags.has(f),
        );
        chart.flags = [
          ...(existingChart.shock ? ["shock"] : []),
          ...(chart.flags ?? []),
        ];
        if (
          meaningfulChartFlags.length !== chart.flags.length ||
          meaningfulChartFlags.some((f, i) => f !== chart.flags[i])
        ) {
          console.log(
            `Updating flags of ${sanbaiSong.name} ${chart.diffClass}`,
          );
          existingChart.flags = [
            ...(existingChart.flags?.filter((f) => manualyAddFlags.has(f)) ??
              []),
            ...(chart.flags ?? []),
          ];
          if (!existingChart.flags.length) {
            delete existingChart.flags;
          }
        }
      }

      // Update song flags
      const meaningfulSongFlags = (existingSong.flags ?? []).filter(
        (f) => !manualyAddFlags.has(f),
      );
      if (
        meaningfulSongFlags.length !== (sanbaiSong.flags?.length ?? 0) ||
        meaningfulSongFlags.some((f, i) => f !== sanbaiSong.flags[i])
      ) {
        console.log(
          `Updating flags [${existingSong.flags}] from ${existingSong.name}`,
        );
        existingSong.flags = [
          ...(existingSong.flags?.filter((f) => manualyAddFlags.has(f)) ?? []),
          ...(sanbaiSong.flags ?? []),
        ];
        if (!existingSong.flags.length) {
          delete existingSong.flags;
        }
      }

      // Fill remyLink/jacket/bpm/artist if missing
      if (!existingSong.remyLink) {
        const remyLink = await guessUrlFromName(sanbaiSong.name);
        console.log("guessed url as " + (remyLink || "null"));
        existingSong.remyLink = remyLink || null;
      }
      if (!existingSong.jacket) {
        if (existingSong.remyLink) {
          console.log(
            `missing jacket for ${existingSong.name}, fetching from remy`,
          );
          existingSong.jacket = await getJacketFromRemySong(
            existingSong.remyLink,
            existingSong.name,
          );
        }
        // Download jacket from 3icecream if still missing
        if (!existingSong.jacket) {
          console.log(
            `missing jacket for ${existingSong.name}, fetching from 3icecream`,
          );
          existingSong.jacket = downloadJacket(
            importer.getJacketUrl(sanbaiSong),
            sanbaiSong.name,
          );
        }
        console.log(`updated jacket property to ${existingSong.jacket}`);
      }
      if (existingSong.artist === "???" || existingSong.bpm === "???") {
        if (existingSong.remyLink) {
          const meta = await getMetaFromRemy(existingSong.remyLink);
          existingSong.artist = meta.artist || existingSong.artist;
          existingSong.bpm = meta.bpm || existingSong.bpm;
        }
      }
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
        jacket = downloadJacket(
          importer.getJacketUrl(sanbaiSong),
          sanbaiSong.name,
        );
      }
      const meta = remyLink
        ? await getMetaFromRemy(remyLink)
        : { artist: null, bpm: null };
      existingData.songs.push({
        name: sanbaiSong.name,
        name_translation: sanbaiSong.name_translation,
        artist: meta.artist || sanbaiSong.artist || "???",
        bpm: meta.bpm || sanbaiSong.bpm || "???",
        charts: sanbaiSong.charts,
        flags: sanbaiSong.flags,
        jacket,
        remyLink,
        saHash: sanbaiSong.saHash,
        search_hint: sanbaiSong.search_hint,
      });
    }
  });

  await Promise.all(tasks);
  await requestQueue.onIdle();

  existingData.songs = sortSongs(existingData.songs);

  const { SONG_DATA_LAST_UPDATED_unixms: lastUpdated } = await import(
    "./scraping/songdata.mjs"
  );
  await writeJsonData(existingData, targetFile, lastUpdated);

  console.log(`Successfully updated ${MIX_META.filename}`);
  console.log(`Total songs in database: ${existingData.songs.length}`);
  console.log(
    `Songs from 3icecream: ${sanbaiSongs.filter((s) => !s.deleted).length}`,
  );
  console.log("Done");
} catch (e) {
  console.error("Error updating sanbai data:", e);
  process.exitCode = 1;
}

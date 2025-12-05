/**
 * Script to import SMX data from direct from statmaniax (thanks cube!)
 */
import { readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import task from "tasuku";

import {
  downloadJacketAsync,
  requestQueue,
  reportQueueStatusLive,
  writeJsonData,
} from "./utils.mts";
import type { Chart, GameData, Song } from "../src/models/SongData.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * queues a cover path for download,
 * returns the filename that will eventually be used
 */
async function fetchJacket(coverPath: string): Promise<string> {
  coverPath = join(coverPath, "cover.png");
  const coverStub = coverPath.split("/")[2];
  const outPath = `smx/${coverStub}.jpg`;
  await downloadJacketAsync(
    `https://data.stepmaniax.com/${coverPath}`,
    outPath,
  );
  return outPath;
}

type SMXSongData = Record<
  string,
  {
    title: string;
    subtitle: string;
    artist: string;
    label: string;
    bpm: string;
    cover_path: string;
    genre: string;
    created_at: string;
    website: string;
    difficulties: Record<string, { difficulty: string; name: string }>;
  }
>;

task("Import StepManiaX", async ({ setStatus, setError, task }) => {
  const cleanup = reportQueueStatusLive(task);
  try {
    const targetFile = join(__dirname, "../src/songs/smx.json");
    const existingData: GameData = JSON.parse(
      await readFile(targetFile, { encoding: "utf-8" }),
    );

    setStatus(`Fetching song data from statmaniax.com...`);
    // added in case statmaniax is under load from cab updates and can't
    // handle TLS handshakes in time for the default timeout
    const req = await fetch(`https://statmaniax.com/api/get_song_data`, {
      signal: AbortSignal.timeout(30000),
    });
    const songsById: SMXSongData = await req.json();

    let count = 1;
    let lastUpdatedString = "";
    const totalCount = Object.keys(songsById).length;
    const songs: Song[] = [];
    for (const [songId, song] of Object.entries(songsById)) {
      setStatus(`Processing ${count++}/${totalCount} songs...`);
      const charts = processCharts(song.difficulties);
      if (song.created_at > lastUpdatedString)
        lastUpdatedString = song.created_at;

      const existingSong = existingData.songs.find((s) => s.saIndex === songId);
      if (existingSong) {
        if (
          existingSong.name !== song.title ||
          existingSong.artist !== song.artist ||
          existingSong.bpm !== song.bpm ||
          existingSong.genre !== song.genre ||
          !chartsEquals(existingSong.charts, charts)
        ) {
          await task(
            `${song.title} / ${song.artist || "(No Artist)"}`,
            async ({ setStatus }) => {
              existingSong.name = song.title;
              existingSong.artist = song.artist;
              existingSong.bpm = song.bpm;
              existingSong.genre = song.genre;
              existingSong.charts = charts;
              existingSong.jacket ||= await fetchJacket(song.cover_path);
              setStatus("Updated");
            },
          );
        }
        songs.push(existingSong);
        continue;
      }
      await task(
        `${song.title} / ${song.artist || "(No Artist)"}`,
        async ({ setStatus }) => {
          songs.push({
            name: song.title,
            artist: song.artist,
            bpm: song.bpm,
            genre: song.genre,
            saIndex: songId,
            jacket: await fetchJacket(song.cover_path),
            charts,
          });
          setStatus("Added");
        },
      );

      function processCharts(
        difficulties: SMXSongData[string]["difficulties"],
      ): Chart[] {
        const charts: Chart[] = [];
        for (const diff of Object.values(difficulties)) {
          if (!diff.name) continue;
          const isPlus = diff.name.endsWith("+");
          if (isPlus) {
            diff.name = diff.name.slice(0, -1);
          }
          const chart: Chart = {
            style: diff.name === "team" ? "team" : "solo",
            diffClass: diff.name,
            lvl: +diff.difficulty,
            ...(isPlus ? { flags: ["plus"] } : {}),
          };
          charts.push(chart);
        }
        return charts;
      }

      function chartsEquals(left: Chart[], right: Chart[]) {
        if (left.length !== right.length) return false;
        for (const lChart of left) {
          const match = right.find(
            (rChart) =>
              rChart.style === lChart.style &&
              rChart.diffClass === lChart.diffClass &&
              rChart.flags?.length === lChart.flags?.length,
          );
          if (lChart.lvl !== match?.lvl) return false;
        }
        return true;
      }
    }

    const smxData = {
      ...existingData,
      songs,
    };

    setStatus("finished downloading data, writing final JSON output");
    const lastUpdated = Date.parse(lastUpdatedString.replace(" ", "T") + "Z");
    await writeJsonData(smxData, resolve(targetFile), lastUpdated);

    if (requestQueue.size) {
      setStatus("waiting on images to finish downloading...");
      await requestQueue.onIdle();
    }
    setStatus("done!");
  } catch (e) {
    setError(e);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
});

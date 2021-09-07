/**
 * Script to import SMX data from direct from their API
 */

const fs = require("fs");
const { resolve, join } = require("path");
const prettier = require("prettier");
const fetch = require("node-fetch");
const { downloadJacket, requestQueue } = require("./utils");

const difficulties = [
  "basic",
  "easy",
  "hard",
  "wild",
  "dual",
  "full",
  "team", // ignore, don't see a use case
];

const GET_IMAGES = true;

/**
 * queues a cover path for download,
 * returns the filename that will eventually be used
 */
function queueJacketDownload(coverPath) {
  const coverStub = coverPath.split("/")[2];
  const outPath = `smx/${coverStub}.jpg`;
  if (GET_IMAGES) {
    downloadJacket(
      `https://data.stepmaniax.com/${coverPath}/cover.png`,
      outPath
    );
  }

  return outPath;
}

async function main() {
  const songs = [];
  let lvlMax = 0;

  for (const diff of difficulties) {
    console.log(`pulling ${diff} chart details`);
    const data = await requestQueue.add(
      () =>
        fetch(`https://data.stepmaniax.com/highscores/region/all/${diff}`, {
          method: "POST",
        }),
      {
        priority: 1,
      }
    );
    const { highscores } = await data.json();
    for (const score of highscores) {
      if (!songs[score.song_id]) {
        songs[score.song_id] = {
          name: score.song.title,
          artist: score.song.artist,
          genre: score.song.genre,
          bpm: score.song.bpm,
          jacket: queueJacketDownload(score.song.cover_path),
          charts: [],
        };
        console.log(`added ${score.song.title} (${songs.length} songs total)`);
      }
      songs[score.song_id].charts.push({
        style: diff === "team" ? "team" : "solo",
        lvl: score.difficulty,
        diffClass: diff,
        author: score.steps_author,
      });
      if (score.difficulty > lvlMax) {
        lvlMax = score.difficulty;
      }
    }
  }

  const smxData = {
    meta: {
      styles: ["solo", "team"],
      difficulties: [
        { key: "basic", color: "#03da00" },
        { key: "easy", color: "#d3b211" },
        { key: "hard", color: "#a90a12" },
        { key: "wild", color: "#3406bc" },
        { key: "dual", color: "#1d72af" },
        { key: "full", color: "#00d0b8" },
        { key: "team", color: "#c216ce" },
      ],
      flags: [],
      lvlMax,
    },
    defaults: {
      style: "solo",
      difficulties: ["wild", "hard"],
      flags: [],
      lowerLvlBound: 18,
      upperLvlBound: 22,
    },
    i18n: {
      en: {
        name: "StepManiaX",
        solo: "Solo",
        basic: "Basic",
        easy: "Easy",
        hard: "Hard",
        wild: "Wild",
        dual: "Dual",
        full: "Full",
        team: "Team",
        $abbr: {
          basic: "Basic",
          easy: "Easy",
          hard: "Hard",
          wild: "Wild",
          dual: "Dual",
          full: "Full",
          team: "Team",
        },
      },
    },
    songs: songs.filter((s) => !!s),
  };

  console.log("finished downloading data, writing final JSON output");
  await fs.promises.writeFile(
    resolve(join(__dirname, "../src/songs/smx.json")),
    prettier.format(JSON.stringify(smxData), {
      filepath: "smx.json",
    })
  );

  if (requestQueue.size) {
    console.log("waiting on images to finish downloading...");
    await requestQueue.onIdle();
  }
  console.log("done!");
}

main();

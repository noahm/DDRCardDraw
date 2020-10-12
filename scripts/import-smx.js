/**
 * Script to import SMX data from direct from their API
 */

const fs = require("fs");
const { resolve, join } = require("path");
const prettier = require("prettier");
const fetch = require("node-fetch");
const pqueue = require("p-queue").default;
const jimp = require("jimp");

const queue = new pqueue({
  concurrency: 6, // 6 concurrent max
  interval: 1000,
  intervalCap: 10, // 10 per second max
});

const difficulties = [
  "basic",
  "easy",
  "hard",
  "wild",
  "dual",
  "full",
  // "team", // ignore, don't see a use case
];

const JACKETS_PATH = resolve(__dirname, "../src/assets/jackets/smx");
const GET_IMAGES = true;

/**
 * queues a cover path for download,
 * returns the filename that will eventually be used
 */
function queueJacketDownload(coverPath) {
  const coverStub = coverPath.split("/")[2];
  const filename = `${coverStub}.jpg`;
  const outputDest = join(JACKETS_PATH, filename);
  if (GET_IMAGES && !fs.existsSync(outputDest)) {
    queue
      .add(async () =>
        jimp.read(`https://data.stepmaniax.com/${coverPath}/cover.png`)
      )
      .then((img) =>
        img
          .resize(128, 128)
          .quality(80)
          .writeAsync(outputDest)
      );
  }

  return `smx/${filename}`;
}

async function main() {
  const songs = [];
  let lvlMax = 0;

  for (const diff of difficulties) {
    console.log(`pulling ${diff} chart details`);
    const data = await queue.add(
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
        style: "fun",
        lvl: score.difficulty,
        diffClass: diff,
      });
      if (score.difficulty > lvlMax) {
        lvlMax = score.difficulty;
      }
    }
  }

  const smxData = {
    meta: {
      styles: ["fun"],
      difficulties: [
        { key: "basic", color: "#03da00" },
        { key: "easy", color: "#d3b211" },
        { key: "hard", color: "#a90a12" },
        { key: "wild", color: "#3406bc" },
        { key: "dual", color: "#1d72af" },
        { key: "full", color: "#00d0b8" },
      ],
      flags: [],
      lvlMax,
    },
    defaults: {
      style: "fun",
      difficulties: ["wild", "hard"],
      flags: [],
      lowerLvlBound: 16,
      upperLvlBound: 22,
    },
    i18n: {
      en: {
        name: "StepManiaX",
        fun: "Fun!",
        basic: "Basic",
        easy: "Easy",
        hard: "Hard",
        wild: "Wild",
        dual: "Dual",
        full: "Full",
        $abbr: {
          basic: "Basic",
          easy: "Easy",
          hard: "Hard",
          wild: "Wild",
          dual: "Dual",
          full: "Full",
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

  if (queue.size) {
    console.log("waiting on images to finish downloading...");
    await queue.onIdle();
  }
  console.log("done!");
}

main();

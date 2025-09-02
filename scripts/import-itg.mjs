import { parsePack } from "simfile-parser";
import {
  writeJsonData,
  downloadJacket,
  unlockRequestConcurrency,
} from "./utils.mjs";
import { resolve, join, basename, extname, dirname } from "path";
import { existsSync, readdirSync } from "fs";

unlockRequestConcurrency();

const __dirname = import.meta.dirname;

const [, , inputPath, stub, tiered] = process.argv;

if (!inputPath || !stub) {
  console.log("Usage: yarn import:itg path/to/pack stubname [tiered?]");
  process.exit(1);
}
const useTiers = !!tiered;

const packPath = resolve(inputPath);

const pack = parsePack(packPath);

const someColors = {
  beginner: "#98aafd",
  basic: "#2BC856",
  difficult: "#F2F52C",
  expert: "#F64D8B",
  challenge: "#0191F2",
};

const difficulties = new Set();
const styles = new Set();
/** @type {import('../src/models/SongData.js').GameData} */
const data = {
  meta: {
    menuParent: "events",
    flags: [],
    lastUpdated: Date.now(),
    usesDrawGroups: useTiers,
    styles: [],
    difficulties: [],
  },
  defaults: {
    flags: [],
    lowerLvlBound: 1,
    difficulties: [],
    style: "",
    upperLvlBound: 0,
  },
  i18n: {
    en: {
      name: pack.name,
      single: "Single",
      double: "Double",
      beginner: "Beginner",
      basic: "Basic",
      difficult: "Difficult",
      expert: "Expert",
      challenge: "Challenge",
      edit: "Edit",
      $abbr: {
        beginner: "Beg",
        basic: "Bas",
        difficult: "Dif",
        expert: "Exp",
        challenge: "Cha",
        edit: "Edit",
      },
    },
  },
  songs: [],
};

const supportedFormats = new Set([".png", ".jpg", ".gif"]);

function getBestJacket(candidates, songDir) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const target = join(songDir, candidate);
    if (supportedFormats.has(extname(candidate)) && existsSync(target)) {
      return target;
    }
  }
  // no provided tags are usable, search for any image in the song dir
  for (const candidate of readdirSync(songDir)) {
    if (supportedFormats.has(extname(candidate))) {
      return join(songDir, candidate);
    }
  }
  // no image files in song dir, look for a generic pack image in parent folder
  for (const candidate of readdirSync(dirname(songDir))) {
    if (supportedFormats.has(extname(candidate))) {
      return join(dirname(songDir), candidate);
    }
  }
}

/**
 * get the output location for a jacket image
 * @param {string} titleDir path to the song folder as parsed
 */
function getFinalJacketPath(titleDir) {
  return join("itg", stub, basename(titleDir) + ".jpg");
}

for (const parsedSong of pack.simfiles) {
  const { bg, banner, jacket, titleDir } = parsedSong.title;
  let finalJacket = getBestJacket([jacket, bg, banner], titleDir);
  if (finalJacket) {
    finalJacket = downloadJacket(finalJacket, getFinalJacketPath(titleDir));
  }

  let bpm = parsedSong.displayBpm;
  if (bpm === "NaN") {
    if (parsedSong.minBpm === parsedSong.maxBpm) {
      bpm = parsedSong.minBpm.toString();
    } else {
      bpm = `${parsedSong.minBpm}-${parsedSong.maxBpm}`;
    }
  }

  const song = {
    name: parsedSong.title.titleName,
    name_translation: parsedSong.title.translitTitleName || "",
    jacket: finalJacket,
    bpm,
    artist: parsedSong.artist,
    charts: [],
  };
  for (const chart of parsedSong.availableTypes) {
    let chartData = {
      lvl: chart.feet,
      style: chart.mode,
      diffClass: chart.difficulty,
    };
    if (useTiers) {
      let tierMatch = parsedSong.title.titleName.match(
        // tier marker maybe some number of non-digit characters,
        // maybe followed by some number of digits
        /^\[([^\d\]]*)(\d*)\] /i,
      );
      if (tierMatch && tierMatch.length > 0) {
        if (tierMatch[2]) {
          const parsedTier = parseInt(tierMatch[2]);
          chartData.drawGroup = parsedTier;
        } else if (tierMatch[1]) {
          const tierName = tierMatch[1].trim();
          switch (tierName) {
            case "LOW":
              chartData.drawGroup = 1;
              break;
            case "MID/LOW":
              chartData.drawGroup = 2;
              break;
            case "MID":
              chartData.drawGroup = 3;
              break;
            case "UPR/MID":
              chartData.drawGroup = 4;
              break;
            case "UPR":
              chartData.drawGroup = 5;
              break;
            default:
              console.warn(`WARN: unhandled tier name '${tierName}'`);
          }
        }
      } else {
        console.error(
          'Expected song titles to include tiers in the form "[T01] ..." but found:\n  ' +
            parsedSong.title.titleName,
          "From folder: " + parsedSong.title.titleDir,
        );
      }
    }
    song.charts.push(chartData);

    difficulties.add(chart.difficulty);
    styles.add(chart.mode);
  }
  data.songs.push(song);
}

data.meta.styles = Array.from(styles);
data.defaults.difficulties = Array.from(difficulties);
data.meta.difficulties = data.defaults.difficulties.map((key) => ({
  key,
  color: someColors[key] || "grey", // TODO?
}));
let lowest = Infinity;
let highest = 0;
for (const song of data.songs) {
  for (const chart of song.charts) {
    if (lowest > chart.lvl) lowest = chart.lvl;
    if (highest < chart.lvl) highest = chart.lvl;
  }
}
data.defaults.lowerLvlBound = lowest;
data.defaults.upperLvlBound = highest;
data.defaults.style = data.meta.styles[0];

writeJsonData(data, resolve(join(__dirname, `../src/songs/${stub}.json`)));

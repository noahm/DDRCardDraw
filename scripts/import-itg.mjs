import { parsePack } from "simfile-parser";
import {
  downloadJacket,
  unlockRequestConcurrency,
  writeJsonData,
} from "./utils.mts";
import { resolve, join, extname, dirname } from "path";
import { readdirSync } from "fs";

unlockRequestConcurrency();

const __dirname = import.meta.dirname;

const [, , inputPath, stub, tiered] = process.argv;

if (!inputPath || !stub) {
  console.log("Usage: yarn import:itg path/to/pack[.zip] stubname [tiered?]");
  process.exit(1);
}
const useTiers = !!tiered;

const packPath = resolve(inputPath);

// accepts either an unpacked pack folder or a .zip of one
const pack = await parsePack(packPath);

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
    flags: ["noCmod"],
    lastUpdated: Date.now(),
    usesDrawGroups: useTiers,
    styles: [],
    difficulties: [],
  },
  defaults: {
    flags: ["noCmod", "Base", "Lower", "Upper"],
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
      noCmod: "No CMOD",
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

/**
 * Pick the image to use as a song's jacket. The parser only reports images that
 * actually exist now, so a tagged one just has to be a format we can read.
 * @param {import('simfile-parser').Title} title parsed metadata for the song
 * @returns {import('simfile-parser').ImageRef | string | undefined} an image
 * the parser found, or a path to one we went looking for ourselves
 */
function getBestJacket(title) {
  // itg should prioritize the banner, then the background, then the jacket
  for (const candidate of [title.banner, title.bg, title.jacket]) {
    if (
      candidate &&
      supportedFormats.has(extname(candidate.name).toLowerCase())
    ) {
      return candidate;
    }
  }
  // nothing usable is tagged. A song read out of an archive is only what the
  // parser handed us, but one on disk can still be rummaged through.
  if (!title.titlePath) {
    return;
  }
  // search for any image in the song dir
  for (const candidate of readdirSync(title.titlePath)) {
    if (supportedFormats.has(extname(candidate).toLowerCase())) {
      return join(title.titlePath, candidate);
    }
  }
  // no image files in song dir, look for a generic pack image in parent folder
  const packDir = dirname(title.titlePath);
  for (const candidate of readdirSync(packDir)) {
    if (supportedFormats.has(extname(candidate).toLowerCase())) {
      return join(packDir, candidate);
    }
  }
}

/**
 * get the output location for a jacket image
 * @param {string} titleDir name of the song folder as parsed
 */
function getFinalJacketPath(titleDir) {
  return join("itg", stub, titleDir + ".jpg");
}

for (const parsedSong of pack.simfiles) {
  const { titleDir } = parsedSong.title;
  const bestJacket = getBestJacket(parsedSong.title);
  const finalJacket = bestJacket
    ? downloadJacket(bestJacket, getFinalJacketPath(titleDir))
    : undefined;

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
    folder: titleDir,
    charts: [],
  };

  // add "noCmod" flag if any title fields contain "no cmod"
  const titles = [
    parsedSong.title.titleName,
    parsedSong.title.translitTitleName,
    parsedSong.subtitle.subtitleName,
    parsedSong.subtitle.translitSubtitleName,
  ];
  const isNoCmod = titles.some((title) =>
    title?.toLowerCase().includes("no cmod"),
  );

  for (const chart of parsedSong.availableTypes) {
    let chartData = {
      lvl: chart.feet,
      style: chart.mode,
      diffClass: chart.difficulty,
      flags: isNoCmod ? ["noCmod"] : undefined,
    };
    if (useTiers) {
      let tierMatch = parsedSong.title.titleName.match(
        // tier marker maybe some number of non-digit characters,
        // maybe followed by some number of digits
        /^\[([^\d\]]*)(\d*)\] /i,
      );
      if (!tierMatch) {
        tierMatch = parsedSong.title.titleDir.match(
          // tier marker maybe some number of non-digit characters,
          // maybe followed by some number of digits
          /^\[([^\d\]]*)(\d*)\] /i,
        );
      }
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

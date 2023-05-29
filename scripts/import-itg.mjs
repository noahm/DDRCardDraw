import { parsePack } from "simfile-parser";
import { writeJsonData, downloadJacket } from "./utils.mjs";
import { resolve, join, basename, extname, dirname } from "path";
import { existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const [, , inputPath, stub] = process.argv;

if (!inputPath || !stub) {
  console.log("Usage: yarn import:itg path/to/pack stubname");
  process.exit(1);
}

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
const data = {
  meta: {
    flags: [],
    lvlMax: 0,
    lastUpdated: Date.now(),
  },
  defaults: {
    flags: [],
    lowerLvlBound: 1,
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
    ja: {
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

for (const parsedSong of pack.simfiles) {
  const { bg, banner, jacket, titleDir } = parsedSong.title;
  let finalJacket = getBestJacket([jacket, bg, banner], titleDir);
  if (finalJacket) {
    finalJacket = downloadJacket(
      finalJacket,
      join("itg", stub, basename(titleDir) + ".jpg")
    );
  }

  const song = {
    name: parsedSong.title.titleName,
    name_translation: parsedSong.title.translitTitleName || "",
    jacket: finalJacket,
    bpm: parsedSong.displayBpm,
    artist: parsedSong.artist,
    charts: [],
  };
  for (const chart of parsedSong.availableTypes) {
    song.charts.push({
      lvl: chart.feet,
      style: chart.mode,
      diffClass: chart.difficulty,
    });
    data.meta.lvlMax = Math.max(data.meta.lvlMax, chart.feet);
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
data.defaults.upperLvlBound = data.meta.lvlMax;
data.defaults.style = data.meta.styles[0];

writeJsonData(data, resolve(join(__dirname, `../src/songs/${stub}.json`)));

const { parsePack } = require("simfile-parser");
const { writeJsonData, downloadJacket } = require("./utils");
const { resolve, join, basename } = require("path");

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

for (const parsedSong of pack.simfiles) {
  const { bg, banner, jacket } = parsedSong.title;
  let finalJacket = jacket || bg || banner;
  if (finalJacket) {
    finalJacket = downloadJacket(
      join(parsedSong.title.titleDir, finalJacket),
      join("itg", pack.name, basename(parsedSong.title.titleDir) + ".jpg")
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

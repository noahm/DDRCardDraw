const { getPack } = require("simfile-parser");
const { writeJsonData, downloadJacket } = require("./utils");
const { resolve, join, extname } = require("path");

const packPath = resolve(process.argv[2]);

const pack = getPack(packPath);

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

function dropExt(name) {
  const ext = extname(name);
  if (ext) {
    return name.slice(0, -ext.length);
  }
  return ext;
}

for (const parsedSong of pack.simfiles) {
  const { bg, banner, jacket } = parsedSong.title;
  let finalJacket = jacket || bg || banner;
  if (finalJacket) {
    finalJacket = downloadJacket(
      join(parsedSong.title.titleDir, finalJacket),
      join("itg", pack.name, dropExt(finalJacket) + ".jpg")
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
  color: "grey", // TODO?
}));
data.defaults.upperLvlBound = data.meta.lvlMax;
data.defaults.style = data.meta.styles[0];

writeJsonData(data, resolve(join(__dirname, `../src/songs/${pack.name}.json`)));

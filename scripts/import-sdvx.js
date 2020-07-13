/**
 * Script to import SDVX data from a `music_db.xml` file
 * Requires
 */

const fs = require("fs").promises;
const { resolve, join } = require("path");
const { parseStringPromise } = require("xml2js");
const iconv = require("iconv-lite");
const prettier = require("prettier");

const OUTFILE = "src/songs/sdvx.json";
const JACKETS_PATH = 'src/assets/jackets/sdvx';

async function main() {
  const sdvxFile = process.argv[2];
  if (!sdvxFile) {
    console.log(
      `No data file provided. Invoke like 'yarn import:sdvx path/to/music_db.xml'`
    );
    return;
  }

  console.log(`opening ${sdvxFile} for import...`);

  const fileContents = iconv.decode(await fs.readFile(sdvxFile), "shift_jis");
  const fileData = await parseStringPromise(fileContents);

  console.log(`successfully parsed ${sdvxFile}, importing data...`);

  console.log(`getting list of song jackets from ${JACKETS_PATH}`);
  const availableJackets = new Set(await fs.readdir(JACKETS_PATH));

  const data = {
    meta: {
      styles: ["single"],
      difficulties: [
        { key: "novice", color: "#800080" },
        { key: "advanced", color: "#ffffaa" },
        { key: "exhaust", color: "#ff0000" },
        { key: "maximum", color: "#808080" },
        { key: "infinite", color: "#ffbae7" },
        { key: "gravity", color: "#ff8c00" },
        { key: "heavenly", color: "#00ffff" },
        { key: "vivid", color: "#f52a6e" },
      ],
      flags: [],
      lvlMax: 20,
    },
    defaults: {
      style: "single",
      difficulties: [
        "exhaust", 
        "maximum",
        "infinite",
        "gravity",
        "heavenly",
        "vivid"
      ],
      flags: [],
      lowerLvlBound: 16,
      upperLvlBound: 19,
    },
    i18n: {
      en: {
        name: "SDVX: VW",
        single: "Single",
        novice: "Novice",
        advanced: "Advanced",
        exhaust: "Exhaust",
        maximum: "Maximum",
        infinite: "Infinite",
        gravity: "Gravity",
        heavenly: "Heavenly",
        vivid: "Vivid",
        $abbr: {
          novice: "NOV",
          advanced: "ADV",
          exhaust: "EXH",
          maximum: "MXM",
          infinite: "INF",
          gravity: "GRV",
          heavenly: "HVN",
          vivid: "VVD"
        },
      },
      ja: {
        name: "SDVX: VW",
        single: "Single",
        novice: "Novice",
        advanced: "Advanced",
        exhaust: "Exhaust",
        maximum: "Maximum",
        infinite: "Infinite",
        gravity: "Gravity",
        heavenly: "Heavenly",
        vivid: "Vivid",
        $abbr: {
          novice: "NOV",
          advanced: "ADV",
          exhaust: "EXH",
          maximum: "MXM",
          infinite: "INF",
          gravity: "GRV",
          heavenly: "HVN",
          vivid: "VVD"
        },
      },
    },
    songs: fileData.mdb.music.filter(filterUnplayableSongs).map(song => buildSong(song, availableJackets)),
  };

  console.log(`successfully imported data, writing data to ${OUTFILE}`);
  await fs.writeFile(
    resolve(join(__dirname, "../src/songs/sdvx.json")),
    prettier.format(JSON.stringify(data), { filepath: "sdvx.json" })
  );
}

function determineDiffClass(song, chartType) {
  if (chartType !== "infinite") {
    return chartType;
  }
  const infVersion = parseInt(song.info[0].inf_ver[0]._);
  switch (infVersion) {
    case 2:
      return "infinite";
    case 3:
      return "gravity";
    case 4:
      return "heavenly";
    case 5:
      return "vivid";
  }
}

const songIdsToSkip = new Set([
  840,  // Grace's Tutorial https://remywiki.com/GRACE-chan_no_chou~zetsu!!_GRAVITY_kouza_w
  1219, // Maxima's Tutorial https://remywiki.com/Maxima_sensei_no_mankai!!_HEAVENLY_kouza
  1259, // AUTOMATION PARADISE
  1438, // AUTOMATION PARADISE, April Fools
]);
function filterUnplayableSongs(song) {
  return !songIdsToSkip.has(parseInt(song.$.id));
}

function determineChartJacket(chartType, song, availableJackets) {
  const songId = ('000' + parseInt(song.$.id)).slice(-4);
  const diffClassToNumber = {
    "novice": 1,
    "advanced": 2,
    "exhaust": 3,
    "infinite": 4,
    "maximimum": 5
  }
  // if a chart does not have difficulty-specific song jackets, then they share the "novice" jacket
  let jacketName = `jk_${songId}_${diffClassToNumber[chartType]}_s.png`;
  if (!availableJackets.has(jacketName)) {
    return undefined;
  }
  return `sdvx/${jacketName}`;
}

function buildSong(song, availableJackets) {
  const info = song.info[0];

  const bpmMax = info.bpm_max[0]._.slice(0, -2);
  const bpmMin = info.bpm_min[0]._.slice(0, -2);
  let bpm = bpmMax;
  if (bpmMin !== bpmMax) {
    bpm = `${bpmMin}-${bpmMax}`;
  }

  const charts = [];
  let usesSharedJacket = false;
  for (const chartType of Object.keys(song.difficulty[0])) {
    const chartInfo = song.difficulty[0][chartType][0];

    const lvl = parseInt(chartInfo.difnum[0]._, 10);
    if (lvl < 1) {
      continue;
    }

    const chartJacket = determineChartJacket(chartType, song, availableJackets);
    if (!chartJacket) {
      usesSharedJacket = true;
    }

    charts.push({
      lvl,
      style: "single",
      diffClass: determineDiffClass(song, chartType),
      jacket: chartJacket,
    });
  }
  
  if (usesSharedJacket) {
    charts.find(c => c.diffClass === "novice").jacket = undefined;
  }
  
  return {
    name: info.title_name[0],
    search_hint: info.ascii[0],
    artist: info.artist_name[0],
    jacket: usesSharedJacket
              ? `sdvx/jk_${('000' + parseInt(song.$.id)).slice(-4)}_1_s.png`
              : "sdvx5.png",
    bpm,
    charts,
  };
}

main();

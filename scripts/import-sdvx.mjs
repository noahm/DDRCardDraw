/**
 * Script to import SDVX data from a `music_db.xml` file
 */

import { promises as fs } from "fs";
import { resolve, join, dirname } from "path";
import { parseStringPromise } from "xml2js";
import iconv from "iconv-lite";
import { fileURLToPath } from "url";
import { writeJsonData } from "./utils.mts";
import { SDVX_UNLOCK_IDS, UNPLAYABLE_IDS } from "./sdvx/unlocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @typedef {import("../src/models/SongData.js").Song} Song */
/** @typedef {import("../src/models/SongData.js").Chart} Chart */
/** @typedef {import("../src/models/SongData.js").GameData} GameData */

/**
 * @template {Record<string, unknown>} T
 * @param {T} object
 * @returns {Array<keyof T>}
 */
function typedKeys(object) {
  return Object.keys(object);
}

const OUTFILE = "src/songs/sdvx_nabla.json";
const JACKETS_PATH = "src/assets/jackets/sdvx";

const radarAxes = [
  "notes",
  "peak",
  "tsumami",
  "tricky",
  "hand-trip",
  "one-hand",
];
const chartTypes = [
  "novice",
  "advanced",
  "exhaust",
  "infinite",
  "maximum",
  "ultimate",
];
/**
 * @param {string} radarAxis
 */
function radarAxisToFlag(radarAxis) {
  return `radar-peak:${radarAxis}`;
}
const allRadarFlags = radarAxes.map(radarAxisToFlag);

function versionNumToString(version) {
  switch (parseInt(version)) {
    case 1:
      return "booth";
    case 2:
      return "infinite";
    case 3:
      return "gravity";
    case 4:
      return "heavenly";
    case 5:
      return "vivid";
    case 6:
      return "exceed";
    case 7:
      return "nabla";
  }
}

async function getJackets() {
  const jacketDirs = await fs.readdir(JACKETS_PATH);
  const availableJackets = [];
  for (const dir of jacketDirs) {
    const verJackets = await fs.readdir(`${JACKETS_PATH}/${dir}`);
    availableJackets.push(...verJackets);
  }
  return availableJackets;
}

async function main() {
  let sdvxDirectory = process.argv[2];
  if (!sdvxDirectory) {
    console.log(
      `No data directory provided. Invoke like 'yarn import:sdvx path/to/data'`,
    );
    return;
  }

  // remove ending slash
  if (sdvxDirectory.slice(-1) == "/" || sdvxDirectory.slice(-1) == "\\") {
    sdvxDirectory = sdvxDirectory.slice(0, -1);
  }

  const sdvxFile = `${sdvxDirectory}/others/music_db.xml`;
  const musicDir = `${sdvxDirectory}/music`;

  console.log(`opening ${sdvxFile} for import...`);

  const fileContents = iconv.decode(await fs.readFile(sdvxFile), "shift_jis");
  const fileData = await parseStringPromise(fileContents);

  console.log(`successfully parsed ${sdvxFile}, importing data...`);

  console.log(`getting list of existing song jackets from ${JACKETS_PATH}`);
  const availableJackets = new Set(await getJackets());

  /** @type {GameData} */
  const data = {
    meta: {
      menuParent: "more",
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
        { key: "exceed", color: "#0047AB" },
        { key: "nabla", color: "#00ff00" },
        { key: "ultimate", color: "#efbf04" },
      ],
      flags: typedKeys(SDVX_UNLOCK_IDS).concat(allRadarFlags),
      lastUpdated: Date.now(),
    },
    defaults: {
      style: "single",
      difficulties: [
        "exhaust",
        "maximum",
        "infinite",
        "gravity",
        "heavenly",
        "vivid",
        "exceed",
        "nabla",
        "ultimate",
      ],
      flags: ["omegaDimension", "hexadiver", "otherEvents", ...allRadarFlags],
      lowerLvlBound: 16,
      upperLvlBound: 19,
    },
    i18n: {
      en: {
        name: "SDVX: ∇",
        single: "Single",
        novice: "Novice",
        advanced: "Advanced",
        exhaust: "Exhaust",
        maximum: "Maximum",
        infinite: "Infinite",
        gravity: "Gravity",
        heavenly: "Heavenly",
        ultimate: "Ultimate",
        vivid: "Vivid",
        exceed: "Exceed",
        nabla: "Nabla",
        omegaDimension: "Blaster Gate/Omega Dimension",
        hexadiver: "Hexadiver",
        variantgate: "Variant Gate",
        otherEvents: "Time-limited & Other Events",
        jpOnly: "J-Region Exclusive",
        ...radarAxes.reduce((prev, curr) => {
          prev[radarAxisToFlag(curr)] = `Radar Peak: ${curr}`;
          return prev;
        }, {}),
        $abbr: {
          novice: "NOV",
          advanced: "ADV",
          exhaust: "EXH",
          maximum: "MXM",
          infinite: "INF",
          gravity: "GRV",
          heavenly: "HVN",
          vivid: "VVD",
          exceed: "XCD",
          nabla: "NBL",
          ultimate: "ULT",
        },
      },
      ja: {
        name: "SDVX: ∇",
        single: "Single",
        novice: "Novice",
        advanced: "Advanced",
        exhaust: "Exhaust",
        maximum: "Maximum",
        infinite: "Infinite",
        gravity: "Gravity",
        heavenly: "Heavenly",
        vivid: "Vivid",
        exceed: "Exceed",
        nabla: "Nabla",
        ultimate: "Ultimate",
        $abbr: {
          novice: "NOV",
          advanced: "ADV",
          exhaust: "EXH",
          maximum: "MXM",
          infinite: "INF",
          gravity: "GRV",
          heavenly: "HVN",
          vivid: "VVD",
          exceed: "XCD",
          nabla: "NBL",
          ultimate: "ULT",
        },
      },
    },
    songs: await Promise.all(
      fileData.mdb.music
        .filter(filterUnplayableSongs)
        .map((song) => buildSong(song, availableJackets, musicDir)),
    ),
  };

  console.log(`successfully imported data, writing data to ${OUTFILE}`);
  const outfilePath = resolve(join(__dirname, "../src/songs/sdvx_nabla.json"));
  writeJsonData(data, outfilePath);
}

function determineDiffClass(song, chartType) {
  if (chartType !== "infinite") {
    return chartType;
  }
  const infVersion = parseInt(song.info[0].inf_ver[0]._);
  return versionNumToString(infVersion);
}

const songIdsToSkip = new Set(UNPLAYABLE_IDS);
function filterUnplayableSongs(song) {
  return !songIdsToSkip.has(parseInt(song.$.id));
}

async function songToJacketNames(song, musicDir) {
  const info = song.info[0];
  const dirName = `${musicDir}/${song.$.id.padStart(4, "0")}_${info.ascii[0]}`;
  const songFolder = await fs.readdir(dirName);
  return songFolder
    .filter((fileName) => fileName.slice(-6) == "_s.png")
    .map((fileName) => `${dirName}/${fileName}`);
}

function determineChartJacket(chartType, song, availableJackets) {
  let chartTypeIdx = chartTypes.findIndex((e) => e == chartType);
  // Convert infinite charts to use correct version name for lookup
  if (chartType == "infinite") {
    chartType = versionNumToString(song.info[0].inf_ver[0]._);
  }
  // if a chart does not have difficulty-specific song jackets, then they share the "novice" jacket
  let jacketName = `${song.info[0].ascii[0]}-${chartType}.png`;
  if (!availableJackets.has(jacketName)) {
    if (
      availableJackets.has(`${song.info[0].ascii[0]}.png`) ||
      chartTypeIdx == 0
    ) {
      return undefined;
    }
    // fallback to the highest named jacket
    return determineChartJacket(
      chartTypes[chartTypeIdx - 1],
      song,
      availableJackets,
    );
  }
  return `sdvx/${versionNumToString(song.info[0].version[0]._)}/${jacketName}`;
}

/**
 *
 * @param {string} input in the format YYYYMMDD
 * @returns date string with dash separators YYYY-MM-DD
 */
function reformatDate(input) {
  return `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(-2)}`;
}

/**
 *
 * @param {*} song
 * @param {*} availableJackets
 * @returns {Song}
 */
async function buildSong(song, availableJackets, musicDir) {
  const numericId = Number.parseInt(song.$.id, 10);
  const info = song.info[0];
  // Fix accent issues with title/artist
  let accent_lut = {
    驩: "Ø",
    齲: "♥",
    齶: "♡",
    黻: "*",
    釁: "🍄",
    闃: "Ā",
    蔕: "ῦ",
    鑷: "ゔ",
    饌: "²",
    趁: "Ǣ",
    瀑: "À",
    鹹: "Ĥ",
    躔: "★",
    壥: "Є",
    騫: "á",
    曦: "à",
    驫: "ā",
    齷: "é",
    曩: "è",
    罇: "ê",
    骭: "ü",
    隍: "Ü",
    雋: "Ǜ",
    鬻: "♃",
    鬥: "Ã",
    鬆: "Ý",
    鬮: "¡",
    龕: "€",
    蹙: "ℱ",
    頽: "ä",
    彜: "ū",
    餮: "Ƶ",
    墸: "\u035f\u035f\u035e\u0020",
    盥: "⚙︎",
    疉: "Ö",
    鑒: "₩",
    煢: "ø",
    鷸: "♫",
  };

  let name = info.title_name[0];
  let artist = info.artist_name[0];
  for (const [orig, rep] of Object.entries(accent_lut)) {
    name = name.replaceAll(orig, rep);
    artist = artist.replaceAll(orig, rep);
  }

  const bpmMax = info.bpm_max[0]._.slice(0, -2);
  const bpmMin = info.bpm_min[0]._.slice(0, -2);
  let bpm = bpmMax;
  if (bpmMin !== bpmMax) {
    bpm = `${bpmMin}-${bpmMax}`;
  }

  /** @type {Array<Chart>} */
  const charts = [];
  let hasJacket = false;
  let usesSharedJacket = false;
  for (const chartType of Object.keys(song.difficulty[0])) {
    const chartInfo = song.difficulty[0][chartType][0];

    const lvl = parseInt(chartInfo.difnum[0]._, 10) / 10;
    if (lvl < 1) {
      continue;
    }

    const radarValues = {};
    for (const radarType of radarAxes) {
      radarValues[radarType] = parseInt(chartInfo.radar[0][radarType][0]._, 10);
    }
    // highest radar value of all six axes
    const peakValue = Math.max(...Object.values(radarValues));
    // all keys tied with radar value
    const peakKeys = Object.keys(radarValues).filter(
      (key) => radarValues[key] === peakValue,
    );

    const chartJacket = determineChartJacket(chartType, song, availableJackets);
    if (!chartJacket && availableJackets.has(`${info.ascii[0]}.png`)) {
      usesSharedJacket = true;
    }

    if (chartJacket || usesSharedJacket) {
      hasJacket = true;
    }

    /** @type {Chart} */
    const chart = {
      lvl,
      style: "single",
      diffClass: determineDiffClass(song, chartType),
      jacket: chartJacket,
    };
    /** @type {string[]} */
    const flags = peakKeys.map(radarAxisToFlag);
    for (const flag of typedKeys(SDVX_UNLOCK_IDS)) {
      if (
        SDVX_UNLOCK_IDS[flag].some(
          (item) =>
            typeof item !== "number" &&
            item[0] === numericId &&
            item[1] === chart.diffClass,
        )
      ) {
        flags.push(flag);
      }
    }
    if (flags.length) {
      chart.flags = flags;
    }

    charts.push(chart);
  }

  // if no jackets, import from data
  if (!hasJacket) {
    const jacketNames = await songToJacketNames(song, musicDir);
    const verString = versionNumToString(info.version[0]._);
    if (jacketNames.length == 1) {
      fs.copyFile(
        jacketNames[0],
        `${JACKETS_PATH}/${verString}/${info.ascii[0]}.png`,
      );
      usesSharedJacket = true;
    } else {
      jacketNames.forEach((name) => {
        const diffNumber =
          parseInt(name.split("_").findLast((e) => parseInt(e) <= 6)) - 1;
        let diffName = chartTypes[diffNumber];
        if (diffName == "infinite") {
          diffName = versionNumToString(info.inf_ver[0]._);
        }
        const jacketName = `${verString}/${info.ascii[0]}-${diffName}`;
        fs.copyFile(name, `${JACKETS_PATH}/${jacketName}.png`);
        // need to add jacket to chart data
        charts.find((c) => c.diffClass == diffName).jacket =
          `sdvx/${jacketName}.png`;
      });
      // add jacket for other charts
      charts
        .filter((c) => c.jacket == undefined)
        .forEach((c) => {
          const prev = charts[charts.indexOf(c) - 1];
          c.jacket = prev.jacket;
        });
    }
  }

  if (usesSharedJacket) {
    charts.find((c) => c.diffClass === "novice").jacket = undefined;
  }

  /** @type {string[]} */
  const flags = [];
  for (const flag of typedKeys(SDVX_UNLOCK_IDS)) {
    if (SDVX_UNLOCK_IDS[flag].includes(numericId)) {
      flags.push(flag);
    }
  }

  /** @type {Song} */
  const ret = {
    name: name,
    search_hint: info.ascii[0],
    date_added: reformatDate(info.distribution_date[0]._),
    saHash: song.$.id,
    artist: artist,
    jacket: usesSharedJacket
      ? `sdvx/${versionNumToString(info.version[0]._)}/${info.ascii[0]}.png`
      : "sdvx6.png",
    bpm,
    charts,
  };

  if (flags.length) {
    ret.flags = flags;
  }

  return ret;
}

main();

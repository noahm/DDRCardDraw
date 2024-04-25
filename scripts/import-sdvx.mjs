/**
 * Script to import SDVX data from a `music_db.xml` file
 */

import { promises as fs } from "fs";
import { resolve, join, dirname } from "path";
import { parseStringPromise } from "xml2js";
import iconv from "iconv-lite";
import { fileURLToPath } from "url";
import { writeJsonData } from "./utils.mjs";
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

const OUTFILE = "src/songs/sdvx.json";
const JACKETS_PATH = "src/assets/jackets/sdvx";

async function main() {
  const sdvxFile = process.argv[2];
  if (!sdvxFile) {
    console.log(
      `No data file provided. Invoke like 'yarn import:sdvx path/to/music_db.xml'`,
    );
    return;
  }

  console.log(`opening ${sdvxFile} for import...`);

  const fileContents = iconv.decode(await fs.readFile(sdvxFile), "shift_jis");
  const fileData = await parseStringPromise(fileContents);

  console.log(`successfully parsed ${sdvxFile}, importing data...`);

  console.log(`getting list of song jackets from ${JACKETS_PATH}`);
  const availableJackets = new Set(await fs.readdir(JACKETS_PATH));

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
      ],
      flags: typedKeys(SDVX_UNLOCK_IDS),
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
      ],
      flags: [],
      lowerLvlBound: 16,
      upperLvlBound: 19,
    },
    i18n: {
      en: {
        name: "SDVX: EG",
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
        omegaDimension: "Blaster Gate/Omega Dimension",
        hexadiver: "Hexadiver",
        otherEvents: "Time-limited & Other Events",
        jpOnly: "J-Region Exclusive",
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
        },
      },
      ja: {
        name: "SDVX: EG",
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
        },
      },
    },
    songs: fileData.mdb.music
      .filter(filterUnplayableSongs)
      .map((song) => buildSong(song, availableJackets)),
  };

  console.log(`successfully imported data, writing data to ${OUTFILE}`);
  const outfilePath = resolve(join(__dirname, "../src/songs/sdvx.json"));
  writeJsonData(data, outfilePath);
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
    case 6:
      return "exceed";
  }
}

const songIdsToSkip = new Set(UNPLAYABLE_IDS);
function filterUnplayableSongs(song) {
  return !songIdsToSkip.has(parseInt(song.$.id));
}

function determineChartJacket(chartType, song, availableJackets) {
  const songId = ("000" + parseInt(song.$.id)).slice(-4);
  const chartTypeToNumber = {
    novice: 1,
    advanced: 2,
    exhaust: 3,
    infinite: 4,
    maximimum: 5,
  };
  // if a chart does not have difficulty-specific song jackets, then they share the "novice" jacket
  let jacketName = `jk_${songId}_${chartTypeToNumber[chartType]}_s.png`;
  if (!availableJackets.has(jacketName)) {
    return undefined;
  }
  return `sdvx/${jacketName}`;
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
function buildSong(song, availableJackets) {
  const numericId = Number.parseInt(song.$.id, 10);
  const info = song.info[0];
  // Fix accent issues with title/artist
  let accent_lut = {
    驩: "Ø",
    齲: "♥",
    齶: "♡",
    趁: "Ǣ",
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
    charts.find((c) => c.diffClass === "novice").jacket = undefined;
  }

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
      ? `sdvx/jk_${("000" + parseInt(song.$.id)).slice(-4)}_1_s.png`
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

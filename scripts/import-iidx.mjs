/**
 * Import or update IIDX data from textage.cc.
 */

 import { promises as fs } from "fs";
 import * as path from "path";
 import { writeJsonData } from "./utils.mjs";
 import { fileURLToPath } from "url";
 import { JSDOM } from "jsdom";
 import { fakeTextage } from "./scraping/textage.mjs";
 const __dirname = path.dirname(fileURLToPath(import.meta.url));
 
 const OUTFILE = "src/songs/iidx.json";
 // IIDX doesn't have official jacket art.
 // const JACKETS_PATH = "src/assets/jackets/sdvx";

 const textageFiles = [
   "titletbl",
   "actbl",
   "cstbl",
   "cstbl1",
   "cstbl2",
   "cltbl",
   "stepup",
   "datatbl",
   "scrlist"
 ];
 const textageDir = "scripts/scraping/textage" 
 const textageTotal = "./scraping/textage.js"


async function exists(f) {
  try {
    await fs.promises.stat(f);
    return true;
  } catch {
    return false;
  }
}
 
async function main() {
  const rescrape = process.argv[2] || false;

  const targetFile = path.join(
    __dirname,
    "../src/songs",
    "iidx-ac.json",
  );
  var existingData = [];
  await fs.readFile(targetFile, { encoding: "utf-8" }).then(
    (v) => {existingData = JSON.parse(v)},
    (reason) => (console.error("Couldn't find existing data, need to rescrape\n" + reason))
  )

  if (rescrape || !existingData) {
    // actbl from titletbl.js contains the full map of song tags to their genre, artist, and title for each.
    // e_list[2] from titletbl.js contains a list of active unlock events and the associated song tags.
    // get_level(tag, type, num) from scrlist.js has the logic to look up charts by slot.
    /*
    var dom = [];
    await JSDOM.fromURL("https://textage.cc/score/index.html?a001B000", {resources: "usable"})
      .then((d) => (dom = d), (reason) => (console.error(reason)))
    
    console.log(dom.window.eval("actbl"))
    //console.log(dom.window.eval(`get_level("abyss_r", ${chartSlot.indexOf("SPA")}, 1)`))
    */

    let textageDOM = await fakeTextage();
    console.log(textageDOM.window.eval("lc = ['?', 'a', 0, 0, 1, 11, 0, 0, 0];"))
    console.log(textageDOM.window.eval("disp_all();"))
    console.log(textageDOM.window.eval(`Array.from(Array(11).entries()).map((v) => get_level("abyss_r", v[0], 1))`))
    console.log(textageDOM.window.eval(`Array.from(Array(11).entries()).map((v) => get_level("airraid", v[0], 1))`))
    const chartSlot = ["inclusion", "SPB", "SPN", "SPH", "SPA", "SPL", "DPB", "DPN", "DPH", "DPA", "DPL"];
  }

  console.log(`Building chart info database for import using textage JS...`);


  console.log(`Successfully built chart info database using textage JS, importing data...`);

  const data = {
    meta: {
      styles: ["single"],
      difficulties: [
        { key: "beginner", color: "#800080" },
        { key: "normal", color: "#ffffaa" },
        { key: "hyper", color: "#ff0000" },
        { key: "another", color: "#808080" },
        { key: "leggendaria", color: "#ffbae7" },
      ],
      flags: [],
      lvlMax: 20,
    },
    defaults: {
      style: "single",
      difficulties: [
        "beginner",
        "normal",
        "hyper",
        "another",
        "leggendaria",
      ],
      flags: [],
      lowerLvlBound: 1,
      upperLvlBound: 12,
    },
    i18n: {
      en: {
        name: "IIDX: AC (EPOLIS)",     // TODO: automatically determine from textage?
        single: "SP",
        double: "DP",
        beginner: "BEGINNER",
        normal: "NORMAL",
        hyper: "HYPER",
        another: "ANOTHER",
        leggendaria: "LEGGENDARIA",
        $abbr: {
        beginner: "[B]",
        normal: "[N]",
        hyper: "[H]",
        another: "[A]",
        leggendaria: "[L]",
        },
      },
      ja: {
        name: "IIDX: AC (EPOLIS)",     // TODO: automatically determine from textage?
        single: "SP",
        double: "DP",
        beginner: "BEGINNER",
        normal: "NORMAL",
        hyper: "HYPER",
        another: "ANOTHER",
        leggendaria: "LEGGENDARIA",
        $abbr: {
          beginner: "[B]",
          normal: "[N]",
          hyper: "[H]",
          another: "[A]",
          leggendaria: "[L]",
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

const songIdsToSkip = new Set([
  840, // Grace's Tutorial https://remywiki.com/GRACE-chan_no_chou~zetsu!!_GRAVITY_kouza_w
  1219, // Maxima's Tutorial https://remywiki.com/Maxima_sensei_no_mankai!!_HEAVENLY_kouza
  1259, // AUTOMATION PARADISE
  1438, // AUTOMATION PARADISE, April Fools
  1751, // EXCEEED GEAR April Fools https://remywiki.com/Exceed_kamen-chan_no_chotto_issen_wo_exceed_shita_EXCEED_kouza
]);
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
    charts.find((c) => c.diffClass === "novice").jacket = undefined;
  }

  return {
    name: info.title_name[0],
    search_hint: info.ascii[0],
    artist: info.artist_name[0],
    jacket: usesSharedJacket
      ? `sdvx/jk_${("000" + parseInt(song.$.id)).slice(-4)}_1_s.png`
      : "sdvx6.png",
    bpm,
    charts,
  };
}

main();

/**
 * Import or update IIDX data from textage.cc.
 */

 import { promises as fs } from "fs";
 import * as path from "path";
 import { writeJsonData } from "./utils.mjs";
 import { fileURLToPath } from "url";
 import { parseStringPromise } from "xml2js";
 import iconv from "iconv-lite";
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

function listProps(x) {
  var p = []
  for (let k in x) {
    if (x.hasOwnProperty(k)) {
      p.push(k)
    }
  }
  return p
}
 
async function main() {
  const rescrape = process.argv[2] || false;

  const targetFile = path.join(
    __dirname,
    "../src/songs",
    "iidx-ac.json",
  );
  var existingData = null;
  await fs.readFile(targetFile, { encoding: "utf-8" }).then(
    (v) => {existingData = JSON.parse(v)},
    (reason) => (console.error("Couldn't find existing data, need to rescrape\n" + reason))
  )

  console.log(`Building chart info database for import using textage JS...`);


  var data = {
    meta: {
      styles: ["single", "double"],
      difficulties: [
        { key: "beginner", color: "#17ff8b" },
        { key: "normal", color: "#3c9dff" },
        { key: "hyper", color: "#ffa244" },
        { key: "another", color: "#ff3737" },
        { key: "leggendaria", color: "#980053" },
      ],
      flags: ["mypolis",
        "ultimateMobile",
        "worldTourism",
        "residentParty",
        "tripleTribe",
        "xRecord",
        "ichikaGochamaze"],
      lvlMax: 12,
      lastUpdated: 0
    },
    defaults: {
      style: "single",
      difficulties: ["another"],
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
        mypolis: "MYPOLIS DESIGNER",
        ultimateMobile: "ULTIMATE MOBILE ARCADE CONNECT",
        worldTourism: "WORLD TOURISM",
        residentParty: "RESIDENT PARTY",
        tripleTribe: "Triple Tribe",
        xRecord: "X-record",
        ichikaGochamaze: "Ichika's Gochamaze Mix UP!",
        $abbr: {
            beginner: "[B]",
            normal: "[N]",
            hyper: "[H]",
            another: "[A]",
            leggendaria: "[L]"
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
        mypolis: "マイポリスデザイナー",
        ultimateMobile: "ULTIMATE MOBILE アーケード連動",
        worldTourism: "WORLD TOURISM",
        residentParty: "RESIDENT PARTY",
        tripleTribe: "Triple Tribe",
        xRecord: "X-record",
        ichikaGochamaze: "いちかのごちゃまぜMix UP!",
        $abbr: {
            beginner: "[B]",
            normal: "[N]",
            hyper: "[H]",
            another: "[A]",
            leggendaria: "[L]"
        },
      },
    },
    songs: [],
  }
  var eventFlags = new Map(listProps(data.i18n.ja).map((v) => [data.i18n.ja[v], v]))


  if (rescrape || !existingData) {
    let textageDOM = await fakeTextage(rescrape);
    const chartSlot = ["ZZZ", "SPB", "SPN", "SPH", "SPA", "SPL", "DPB", "DPN", "DPH", "DPA", "DPL"];
    existingData = {
      songs: []
    }

    // titletbl from titletbl.js contains the full map of song tags to their genre, artist, and title for each.
    // e_list[2] from titletbl.js contains a list of active unlock events and the associated song tags.
    // get_level(tag, type, num) from scrlist.js has the logic to look up charts by slot.
    const titletbl = textageDOM.window.eval("titletbl")
    const datatbl = textageDOM.window.eval("datatbl")
    const eventMap = textageDOM.window.eval("e_list[2]")
    const eventTagsFull = await Promise.all(Array.from(eventMap.values()).map((v) => (parseStringPromise(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><root>` + v[0] + `</root>`))))
    const eventTags = eventTagsFull
      .map((et) => {return et.root._ || et.root})

    var nSongs = 0
    for (let songTag in titletbl) {
      try {
        const chartLevels = textageDOM.window.eval(`Array.from(Array(11).entries()).map((v) => get_level("${songTag}", v[0], 1))`)
        // TODO: per-chart BPMs should be handled

        var chartData = []
        for (let v of chartSlot.entries()) {
          // DP -> double, SP -> single
          const chartStyle = ["", "double", "single"]["ZDS".indexOf(v[1][0])];
          // Map the slot to the full enumeration element
          const diffClass = (chartStyle != "") ? ["beginner", "normal", "hyper", "another", "leggendaria"]["BNHAL".indexOf(v[1][2])] : "";
          if (diffClass != "") {
            chartData.push({
              style: chartStyle,
              lvl: chartLevels[v[0]],
              diffClass: diffClass
            })
          }
        }
        var nameExt = titletbl[songTag][5]
        if (titletbl[songTag][6]) {
          nameExt += "\n" + titletbl[songTag][6]
        }

        var songFlags = []
        for (let em of eventMap.entries()) {
          if (em[1][1].includes(songTag)) {
            songFlags.push(eventFlags.get(eventTags[em[0]]))
          }
        }

        songData = {
          name: nameExt,
          artist: titletbl[songTag][4] || "[artist N/A]",
          genre: titletbl[songTag][3] || "[genre N/A]",
          flags: songFlags,
          bpm: datatbl[songTag][11] || "[BPM N/A]",
          jacket: "",
          charts: chartData,
          saIndex: nSongs
        }

        existingData.songs.push(songData)
        nSongs++
      }
      catch {
        //console.warn(`Something's up with song tag ${songTag}`)
      }
    }
  }

  data.songs = existingData.songs
      .filter(filterUnplayableSongs)
      .map((song) => buildSong(song, availableJackets))

  console.log(`Successfully built chart info database using textage JS, importing data...`);


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

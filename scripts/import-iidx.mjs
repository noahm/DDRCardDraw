/**
 * Import or update IIDX data from textage.cc.
 */

import { promises as fs } from "fs";
import * as path from "path";
import { writeJsonData } from "./utils.mjs";
import { fileURLToPath } from "url";
import { parseStringPromise } from "xml2js";
import { decode as decodeHTML } from "html-entities";
import { JSDOM } from "jsdom";
import { fakeTextage } from "./scraping/textage.mjs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUTFILE = "src/songs/iidx.json";
// IIDX doesn't have official jacket art, but we're gonna make version folder backdrops.
// const JACKETS_PATH = "src/assets/jackets/sdvx";

const folderNames = [
  "INF etc.", // textage files INFINITAS exclusives as 0th style - subject to change
  "1st style",
  "2nd style",
  "3rd style",
  "4th style",
  "5th style",
  "6th style",
  "7th style",
  "8th style",
  "9th style",
  "10th style",
  "IIDX RED",
  "HAPPY SKY",
  "DistorteD",
  "GOLD",
  "DJ TROOPERS",
  "EMPRESS",
  "SIRIUS",
  "Resort Anthem",
  "Lincle",
  "tricoro",
  "SPADA",
  "PENDUAL",
  "copula",
  "SINOBUZ",
  "CANNON BALLERS",
  "Rootage",
  "HEROIC VERSE",
  "BISTROVER",
  "CastHour",
  "RESIDENT",
  "EPOLIS",
  "Pinky Crush",
  "---",
  "---",
  "substream", // textage files substream charts as 35th style - subject to change
];

const jacketPaletteEntries = ["backdrop", "accentUpper", "accentLower"];
const jacketPalettes = [
  // backdrop, upper accent, lower accent
  ["#000000", "#000000", "#000000"], // 0 = INFINITAS or other non-AC entries
  ["#000000", "#666666", "#333333"], // 1st
  ["#000000", "#feb900", "#d36a00"], // 2nd
  ["#000000", "#e4007f", "#e4007f"], // 3rd
  ["#000000", "#e60012", "#666666"], // 4th
  ["#000000", "#f5a100", "#073190"], // 5th
  ["#000000", "#9983be", "#a5a5a5"], // 6th
  ["#000000", "#488db2", "#264a5c"], // 7th
  ["#000000", "#ef7e00", "#e7e8e8"], // 8th
  ["#000000", "#ffffff", "#01eef6"], // 9th
  ["#000000", "#ff1a00", "#091f58"], // 10th
  ["#000000", "#ff0000", "#7b7978"], // 11th / IIDX RED
  ["#000000", "#14ace9", "#12398b"], // 12th / HAPPY SKY
  ["#000000", "#cabc20", "#666666"], // 13th / DistorteD
  ["#000000", "#d7be52", "#9f0080"], // 14th / GOLD
  ["#000000", "#a3fe09", "#476618"], // 15th / DJ TROOPERS
  ["#000000", "#f40052", "#a12f4c"], // 16th / EMPRESS
  ["#000000", "#2c4d6f", "#0f0c2a"], // 17th / SIRIUS
  ["#000000", "#eb4a32", "#a23351"], // 18th / Resort Anthem
  ["#000000", "#40c0f0", "#ef7c08"], // 19th / Lincle
  ["#000000", "#f4f04b", "#c32137"], // 20th / tricoro
  ["#000000", "#f61108", "#e3751b"], // 21st / SPADA
  ["#000000", "#c93c61", "#990d87"], // 22nd / PENDUAL
  ["#000000", "#fee05a", "#88757e"], // 23rd / copula
  ["#000000", "#44af6a", "#6e2039"], // 24th / SINOBUZ
  ["#000000", "#dc1003", "#05b474"], // 25th / CANNON BALLERS
  ["#000000", "#feef13", "#8f2608"], // 26th / Rootage
  ["#000000", "#331ba5", "#c03ae3"], // 27th / HEROIC VERSE
  ["#000000", "#86d140", "#6098c9"], // 28th / BISTROVER
  ["#000000", "#fb6701", "#1a2162"], // 29th / CastHour
  ["#000000", "#010efd", "#cb2690"], // 30th / RESIDENT
  ["#000000", "#f0ff00", "#6229d1"], // 31st / EPOLIS
  ["#000000", "#ec2f95", "#00f7fe"], // 32nd / Pinky Crush
  ["#000000", "#000000", "#000000"], // 33rd
  ["#000000", "#000000", "#000000"], // 34th
  ["#000000", "#feb900", "#d36a00"], // "35th" / substream
];
const jacketFont = "bold 28px Evogria,sans-serif";
const jacketFontStyling = `fill:white;font:${jacketFont};dominant-baseline:middle;text-anchor:middle;stroke:#000000;stroke-width:2px`;

function measureTextWidth(text) {
  var dom = new JSDOM(`<!DOCTYPE html><head><meta charset="UTF-8"></head>`);
  var document = dom.window.document;
  const canvas = document.createElement("canvas"); // Requires the npm package canvas in the dev environment
  const ctx = canvas.getContext("2d");
  ctx.font = jacketFont;
  const metrics = ctx.measureText(text);
  return metrics.width;
}

// textage.cc doesn't indicate songs that are time-locked or shop-bought, most of the time
// (some are colored red in the list, but not all)
// TODO: bemaniwiki can give us this info, but navigating/reading it may be a bit tricky
// https://bemaniwiki.com/?beatmania+IIDX+32+Pinky+Crush/%B5%EC%B6%CA%A5%EA%A5%B9%A5%C8
const timelockTags = [
  // arena unlocks from last mix
  "fun30",
  "max300",
  "tpolak30",
  "ref_eden",
  // arena unlocks from this mix
  "logic",
  "parasv31",
  "guilty",
  // one-offs (kiwami class unlocks, KAC quals, cross-game promos, etc.)
  "deeproar",
  "_pfeater",
  "_ccj_oni",
  "_isnpyon",
];
// TODO: bemaniwiki can give us this info, but navigating/reading it may be a bit tricky
// https://bemaniwiki.com/?beatmania+IIDX+32+Pinky+Crush/LEGGENDARIA%A5%D5%A5%A9%A5%EB%A5%C0
const timelockLegs = [
  // secret legs from last mix
  "neogenes",
  "blstwind",
  "yheadjoe",
  "bldragon",
  "_koisuru",
  "code_0",
  // secret legs from this mix
  "smooooch",
  "script_n",
  "script_h",
  "alba",
  "bitchoco",
  "_casino",
  "lightstr",
  // arena legs from this & last mix
  "_hyouri",
  "explorer",
  "o_d_20",
  "miracle5",
  "madatack",
  "saturn",
  "pinkr_ra",
  "_kachofu",
  "strtrail",
  "slwyvern",
  "starjunc",
  "_azisai",
  "guilty",
  "lostsoul",
  "zeroone",
  "_wadatmi",
  "dthzigoq",
];
// Some songs come up as part of events, but are actually available now in the default songlist.
const eventReleases = [
  // Triple Tribe 1st & 2nd were both EPOLIS? damn tho
  // "ccrimson",
  // "max_360",
  // "suspcion",
  // ULTIMATE MOBILE time release should be cleared out.
  // "_shvnccd",
];

function listProps(x) {
  var p = [];
  for (let k in x) {
    if (x.hasOwnProperty(k)) {
      p.push(k);
    }
  }
  return p;
}

async function unwrapHTML(s) {
  s = s.replaceAll("<br>", "\n");
  s = s.replaceAll("&", "&amp;");
  s = s.replaceAll("ltmodel", `"ltmodel"`); // lol
  //console.log(s)
  return parseStringPromise(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><root>` +
      s +
      `</root>`
  ).then((v) => {
    var v_inner = JSON.parse(JSON.stringify(v));
    var nested = true;
    while (nested) {
      nested = false;
      v = v[0] || v;
      for (let innerTag of ["span", "font", "div", "root", "_"]) {
        if (v_inner[innerTag]) {
          v_inner = v_inner[innerTag];
          nested = true;
        }
      }
    }
    v_inner = v_inner[0]?._ || v_inner;
    //console.log(v_inner)
    return decodeHTML(v_inner.trim());
  });
}

async function main() {
  const rescrape = process.argv[2] || false;

  const targetFile = path.join(__dirname, "../src/songs", "iidx-ac.json");
  var existingData = null;
  await fs.readFile(targetFile, { encoding: "utf-8" }).then(
    (v) => {
      existingData = JSON.parse(v);
    },
    (reason) =>
      console.error("Couldn't find existing data, need to rescrape\n" + reason)
  );

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
      flags: [
        "mypolis",
        "restoration",
        "singularity",
        "bplSeason4",
        "ultimateMobile",
        "worldTourism",
        "tripleTribe",
        "timelock",
      ],
      lvlMax: 12,
      lastUpdated: 0,
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
        name: "IIDX AC (Pinky Crush)", // TODO: automatically determine from textage?
        single: "SP",
        double: "DP",
        beginner: "BEGINNER",
        normal: "NORMAL",
        hyper: "HYPER",
        another: "ANOTHER",
        leggendaria: "LEGGENDARIA",
        mypolis: "MYPOLIS DESIGNER",
        restoration: "EPOLIS RESTORATION",
        singularity: "EPOLIS SINGULARITY",
        bplSeason4: "BPL SEASON4 PURCHASE PERKS",
        ultimateMobile: "ULTIMATE MOBILE ARCADE CONNECT",
        worldTourism: "WORLD TOURISM",
        tripleTribe: "Triple Tribe",
        timelock: "Time-locked or shop-bought",
        $abbr: {
          beginner: "[B]",
          normal: "[N]",
          hyper: "[H]",
          another: "[A]",
          leggendaria: "[L]",
        },
      },
      ja: {
        name: "IIDX AC (Pinky Crush)", // TODO: automatically determine from textage?
        single: "SP",
        double: "DP",
        beginner: "BEGINNER",
        normal: "NORMAL",
        hyper: "HYPER",
        another: "ANOTHER",
        leggendaria: "LEGGENDARIA",
        mypolis: "マイポリスデザイナー",
        restoration: "EPOLIS RESTORATION",
        singularity: "EPOLIS SINGULARITY",
        bplSeason4: "BPL SEASON4 チケット購入特典",
        ultimateMobile: "ULTIMATE MOBILE アーケード連動",
        worldTourism: "WORLD TOURISM",
        tripleTribe: "Triple Tribe",
        timelock: "現在解禁不可・公式サイトに購入必須",
        $abbr: {
          beginner: "[B]",
          normal: "[N]",
          hyper: "[H]",
          another: "[A]",
          leggendaria: "[L]",
        },
      },
    },
    songs: [],
  };
  var eventFlags = new Map(
    listProps(data.i18n.ja).map((v) => [data.i18n.ja[v], v])
  );

  var songList = existingData ? existingData.songs : [];

  if (rescrape || !existingData) {
    let textageDOM = await fakeTextage(rescrape);
    const chartSlot = [
      "ZZZ",
      "SPB",
      "SPN",
      "SPH",
      "SPA",
      "SPL",
      "DPB",
      "DPN",
      "DPH",
      "DPA",
      "DPL",
    ];

    // titletbl from titletbl.js contains the full map of song tags to the version of origin, genre, artist, and title for each.
    // actbl from actbl.js knows whether each song is present in AC.
    // datatbl from datatbl.js knows which songs have per-chart BPMs and what they are.
    // e_list[2] from titletbl.js contains a list of active unlock events and the associated song tags.
    // get_level(tag, type, num) from scrlist.js has the logic to look up charts by slot.
    const titletbl = textageDOM.window.eval("titletbl");
    const actbl = textageDOM.window.eval("actbl");
    const datatbl = textageDOM.window.eval("datatbl");
    const eventMap = textageDOM.window.eval("e_list[2]");
    const eventTags = await Promise.all(
      Array.from(eventMap.values()).map((v) => unwrapHTML(v[0]))
    );

    for (let songTag in titletbl) {
      try {
        if (!actbl[songTag] || (actbl[songTag][0] & 1) == 0) {
          continue;
        }
        const chartLevels = textageDOM.window.eval(
          `Array.from(Array(11).entries()).map((v) => get_level("${songTag}", v[0], 1))`
        );
        const chartBPMs = textageDOM.window.eval(
          `Array.from(Array(11).entries()).map((v) => get_bpm("${songTag}", v[0]))`
        );
        const songBPM = datatbl[songTag][11] || "[BPM N/A]";

        // Title and subtitle
        var nameExt = decodeHTML(await unwrapHTML(titletbl[songTag][5]), {
          scope: "strict",
        });
        if (titletbl[songTag][6]) {
          nameExt +=
            " " +
            decodeHTML(await unwrapHTML(titletbl[songTag][6]), {
              scope: "strict",
            });
        }

        var chartData = [];
        for (let v of chartSlot.entries()) {
          // DP -> double, SP -> single
          const chartStyle = ["", "double", "single"]["ZDS".indexOf(v[1][0])];
          // Map the slot to the full enumeration element
          const diffClass =
            chartStyle != ""
              ? ["beginner", "normal", "hyper", "another", "leggendaria"][
                  "BNHAL".indexOf(v[1][2])
                ]
              : "";
          const chartLevel = chartLevels[v[0]];
          if (diffClass != "" && chartLevel != 0) {
            // Chart slot exists for this song?
            var chartInfo = {
              style: chartStyle,
              lvl: chartLevel,
              diffClass: diffClass,
            };
            if (chartBPMs[v[0]] != songBPM) {
              // Per-chart BPM?
              chartInfo.bpm = chartBPMs[v[0]];
            }
            if (diffClass == "leggendaria" && timelockLegs.includes(songTag)) {
              // Is the leg an arena unlock or secret unlock?
              console.log(
                `c[] ${songTag} (${nameExt}) [${v[1]}] is an arena unlock or secret unlock`
              );
              chartInfo.flags = ["timelock"];
            }
            chartData.push(chartInfo);
          }
        }

        // Unlock category, if applicable
        var songFlags = [];
        for (let em of eventMap.entries()) {
          if (em[1][1].includes(songTag) && !eventReleases.includes(songTag)) {
            console.log(
              `c[] ${songTag} (${nameExt}) is locked behind the ${em[1][0]} event`
            );
            songFlags.push(eventFlags.get(eventTags[em[0]]));
          }
        }
        if (timelockTags.includes(songTag)) {
          console.log(
            `c[] ${songTag} (${nameExt}) is time-locked or must be acquired through the shop`
          );
          songFlags.push("timelock");
        }

        // Version of origin (or first AC inclusion)
        const folderNumber = titletbl[songTag][0] || 0;
        const folderName = folderNames[folderNumber];
        const folderFile = folderName.replaceAll(" ", "-");

        var songData = {
          name: nameExt,
          artist: decodeHTML(titletbl[songTag][4] || "[artist N/A]", {
            scope: "strict",
          }),
          genre: decodeHTML(titletbl[songTag][3] || "[genre N/A]", {
            scope: "strict",
          }),
          flags: songFlags,
          bpm: songBPM,
          jacket: `iidx/${folderFile}.svg`,
          folder: folderName,
          charts: chartData,
          saIndex: `${songList.length}`,
        };

        songList.push(songData);
      } catch (err) {
        console.warn(`Something's up with song tag ${songTag}:\n${err}`);
      }
    }
  }

  data.songs = songList;

  console.log(`Successfully built chart info database using textage JS`);

  console.log(`Building version folder SVG jackets...`);
  const jacketPath = path.join(__dirname, "../src/assets/jackets/iidx");
  const jacketTemplate = await fs.readFile(
    path.resolve(path.join(__dirname, "jacket_template.svg")),
    { encoding: "utf-8" }
  );
  for (let fn of folderNames.entries()) {
    const folderName = folderNames[fn[0]];
    const folderNameWidth = measureTextWidth(" " + folderName + " ");
    const folderFile = folderName.replaceAll(" ", "-");
    var jacketSpecific = jacketTemplate;
    for (let jp of jacketPaletteEntries.entries()) {
      jacketSpecific = jacketSpecific.replaceAll(
        `{{${jp[1]}}}`,
        jacketPalettes[fn[0]][jp[0]]
      );
    }
    const otherJacketParameters = {
      folderName: folderName,
      folderNameStyling: jacketFontStyling,
      folderNameWidth: `${folderNameWidth}`,
      folderNameWidthHalf: `${folderNameWidth * 0.5}`,
    };
    for (let jp of Object.entries(otherJacketParameters)) {
      jacketSpecific = jacketSpecific.replaceAll(`{{${jp[0]}}}`, jp[1]);
    }
    await fs.writeFile(
      path.resolve(path.join(jacketPath, `${folderFile}.svg`)),
      jacketSpecific,
      { encoding: "utf-8" }
    );
  }
  console.log(`Successfully built version folder SVG jackets`);

  console.log(`Successfully imported data, writing data to ${OUTFILE}`);
  const outfilePath = path.resolve(
    path.join(__dirname, "../src/songs/iidx.json")
  );
  writeJsonData(data, outfilePath);
  console.log(
    `Complete. Make sure new arena and time-locked/shop-bought exclusives are indicated manually!`
  );
}

main();

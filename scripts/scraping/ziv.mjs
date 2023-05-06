// @ts-check
import { JSDOM } from "jsdom";

import { requestQueue, getDom, downloadJacket } from "../utils.mjs";
import { getCanonicalRemyURL, guessUrlFromName } from "./remy.mjs";

/**
 * @param {Function} log
 * @param {string} url
 * @param {boolean} withFolders
 */
export async function getSongsFromZiv(log, url, withFolders = false) {
  log("fetching data from zenius-i-vanisher.com");
  const dom = await requestQueue.add(() => JSDOM.fromURL(url));
  return await scrapeSongData(dom, log, withFolders);
}

const translationNodeQuery = "span[onmouseover]";

/**
 * @param {Element} node
 */
function getTranslationText(node) {
  if (node.nodeName === "#text") {
    return "";
  }
  const translationNode = node.matches(translationNodeQuery)
    ? node
    : node.querySelector(translationNodeQuery);
  if (!translationNode) {
    return "";
  }
  return translationNode.attributes.onmouseover.value.slice(16, -2);
}

const difficultyMap = {
  lightblue: "beginner",
  yellow: "basic",
  fuchsia: "difficult",
  green: "expert",
  purple: "challenge",
};

const titleList = [
  { name: "DanceDanceRevolution A3" },
  { name: "DanceDanceRevolution A20 PLUS" },
  { name: "DanceDanceRevolution A20" },
  { name: "DanceDanceRevolution A" },
  { name: "DanceDanceRevolution (2014)" },
  { name: "DanceDanceRevolution (2013)" },
  { name: "DanceDanceRevolution X3 vs 2nd MIX" },
  { name: "DanceDanceRevolution X2" },
  { name: "DanceDanceRevolution X" },
  { name: "DanceDanceRevolution SuperNOVA2" },
  { name: "DanceDanceRevolution SuperNOVA" },
  { name: "DanceDanceRevolution EXTREME" },
  { name: "DDRMAX2 -DanceDanceRevolution 7thMIX-" },
  { name: "DDRMAX -DanceDanceRevolution 6thMIX-" },
  { name: "DanceDanceRevolution 5th Mix" },
  { name: "DanceDanceRevolution 4th Mix" },
  { name: "DanceDanceRevolution 3rd Mix" },
  { name: "DanceDanceRevolution 2nd Mix" },
  { name: "DanceDanceRevolution 1st Mix" },
];

/**
 * @param {JSDOM} dom
 * @param {Function} log
 * @param {boolean} withFolders
 */
async function scrapeSongData(dom, log, withFolders) {
  /** @type {NodeListOf<HTMLAnchorElement>} */
  const links = dom.window.document.querySelectorAll('a[href^="songdb.php"]');
  if (!withFolders) {
    return Array.from(links).map((link) => createSongData(link));
  }

  /** @type {NodeListOf<HTMLSpanElement>} */
  const spans = dom.window.document.querySelectorAll('th[colspan="11"] span');
  const titleMap = Array.from(spans).map((span, index) => {
    return {
      name: titleList[index].name,
      count: +span.textContent.match(/^[0-9]*/)[0],
    };
  });
  log("Songs scraped:", JSON.stringify(titleMap, undefined, 2));

  const songs = [];
  let loop = 0;
  for (const title of titleMap) {
    for (let current = 0; current < title.count; ) {
      songs.push(createSongData(links[loop], title.name));
      current++;
      loop++;
    }
  }
  return songs;
}

// map from bad ziv title to our better title
const ZIV_TITLE_CORRECTIONS = {
  "CAN'T STOP FALLIN'IN LOVE": "CAN'T STOP FALLIN' IN LOVE",
  "MARIA (I believe... )": "MARIA (I believe...)",
  "魔法のたまご～心菜 ELECTRO POP edition～":
    "魔法のたまご ～心菜 ELECTRO POP edition～",
  "Lachryma(Re:Queen'M)": "Lachryma《Re:Queen’M》",
};

/**
 * @param {HTMLAnchorElement} songLink
 * @param {string=} folder
 * @returns
 */
async function createSongData(songLink, folder) {
  const songRow = songLink.parentElement.parentElement;
  const artistNode = songRow.firstChild.lastChild.textContent.trim()
    ? songRow.firstChild.lastChild
    : songRow.firstChild.lastElementChild;
  const chartNodes = Array.from(songRow.children).slice(2);

  let songName = songLink.text.trim();
  if (ZIV_TITLE_CORRECTIONS[songName]) {
    songName = ZIV_TITLE_CORRECTIONS[songName];
  }
  const songData = {
    name: songName,
    name_translation: getTranslationText(songLink),
    artist: artistNode.textContent.trim(),
    artist_translation: getTranslationText(artistNode),
    bpm: songRow.children[1].textContent.trim(),
    folder,
    charts: getCharts(chartNodes),
    getRemyLink: () => getRemyLinkForSong(songLink, songName),
    getZivJacket: () => getZivJacketForSong(songLink, songName),
  };
  const flags = getFlagsForSong(songLink);
  if (flags) {
    songData.flags = flags;
  }
  return songData;
}

const flagIndex = {
  "DDR GP Early Access": "grandPrixPack",
  "EXTRA SAVIOR A3": "unlock",
  "GOLDEN LEAGUER'S PRIVILEGE": "goldenLeague",
  "EXTRA EXCLUSIVE": "extraExclusive",
  "COURSE TRIAL A3": "unlock",
  "DANCE aROUND × DanceDanceRevolution 2022夏のMUSIC CHOICE": "unlock",
  "いちかのごちゃまぜMix UP！": "tempUnlock",
  "BEMANI 2021真夏の歌合戦5番勝負": "unlock",
};

/**
 * @param {HTMLAnchorElement} songLink
 */
function getFlagsForSong(songLink) {
  /** @type {HTMLImageElement | null} */
  const previous = songLink.previousElementSibling;
  if (previous && previous.src && previous.src.endsWith("lock.png")) {
    const titleBits = previous.title.split(" / ");
    if (titleBits[1]) {
      const flag = flagIndex[titleBits[1].trim()] || titleBits[1].trim();
      return [flag];
    }
    return ["unlock"];
  }
  return undefined;
}

const singlesColumnCount = 5;
/**
 * @param {any[]} chartNodes
 */
function getCharts(chartNodes) {
  const charts = [];
  let index = 0;
  for (const current of chartNodes) {
    index++;
    if (current.firstChild.textContent === "-") continue;
    const chart = {
      lvl: +current.firstChild.textContent,
      style: index > singlesColumnCount ? "double" : "single",
      diffClass: difficultyMap[current.classList[1]],
    };
    const flags = [];
    if (current.firstChild.style.color === "red") {
      flags.push("unlock");
    }
    const [step, freeze, shock] = current.lastElementChild.textContent
      .split(" / ")
      .map(Number);
    if (!isNaN(shock) && shock > 0) {
      flags.push("shock");
    }
    if (flags.length) {
      chart.flags = flags;
    }
    charts.push(chart);
  }
  return charts;
}

/**
 * @param {HTMLAnchorElement} songLink
 * @param {string} name song name (native) for guessing if no wiki link provided
 */
async function getRemyLinkForSong(songLink, name) {
  const dom = await getDom(songLink.href);
  if (!dom) return;
  /** @type {HTMLAnchorElement | null} */
  const remyLink = dom.window.document.querySelector('a[href*="remywiki.com"]');
  if (remyLink) return getCanonicalRemyURL(remyLink.href);

  // try to guess wiki link
  return guessUrlFromName(name);
}

/**
 * @param {HTMLAnchorElement} songLink
 * @param {string} songName for the filename
 */
async function getZivJacketForSong(songLink, songName) {
  const dom = await getDom(songLink.href);
  if (!dom) return;
  const images = dom.window.document.querySelectorAll("img");
  for (const img of images) {
    if (!img.alt || img.alt === "Logo") continue;
    if (img.src) return downloadJacket(img.src, songName);
  }
}

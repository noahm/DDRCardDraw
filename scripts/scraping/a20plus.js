// @ts-check
const { JSDOM } = require("jsdom");
const { default: fetch } = require("node-fetch");
const readline = require("readline");
const iconv = require("iconv-lite");
const he = require("he");

const { requestQueue } = require("../utils");

module.exports = {
  getSongsFromZiv,
  getSongsFromSkillAttack,
};

const difficultyByIndex = [
  "beginner",
  "basic",
  "difficult",
  "expert",
  "challenge",
  "basic",
  "difficult",
  "expert",
  "challenge",
];

async function getSongsFromSkillAttack() {
  const resp = await fetch("http://skillattack.com/sa4/data/master_music.txt");

  return new Promise((resolve) => {
    const decoder = iconv.decodeStream("Shift_JIS");
    resp.body.pipe(decoder);
    const rl = readline.createInterface(decoder);
    const data = [];
    rl.on("line", (rawLine) => {
      const [index, hash, ...fields] = rawLine.split("\t");
      const charts = [];
      let i = 0;
      for (const field of fields) {
        i++;
        if (i > 9) break;
        const lvl = parseInt(field, 10);
        if (lvl < 0) continue;
        charts.push({
          lvl,
          style: i > singlesColumnCount ? "double" : "single",
          diffClass: difficultyByIndex[i - 1],
        });
      }
      data.push({
        saHash: hash,
        saIndex: index,
        name: he.decode(fields[9]),
        artist: he.decode(fields[10]),
        charts,
      });
    });
    rl.on("close", () => {
      resolve(data);
    });
  });
}

/**
 * @return {Promise<Array<{}>>}
 */
function getSongsFromZiv() {
  const ZIV_EXTREME =
    "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=5156&show_notecounts=1&sort=&sort_order=asc";

  return JSDOM.fromURL(ZIV_EXTREME).then(scrapeSongData);
}

const translationNodeQuery = "span[onmouseover]";

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
    if (current.firstChild.style.color === "red") {
      chart.flags = ["unlock"];
    }
    charts.push(chart);
  }
  return charts;
}

async function scrapeSongData(dom) {
  const numbers = [];
  dom.window.document
    .querySelectorAll('th[colspan="11"] span')
    .forEach((node) =>
      numbers.push(Number(node.textContent.match(/^[0-9]*/)[0]))
    );
  const titleMap = numbers.map((number, index) => {
    return {
      name: titleList[index].name,
      number,
    };
  });
  console.log("Songs scraped:", titleMap);

  const songs = [];
  const links = dom.window.document.querySelectorAll('a[href^="songdb.php"]');
  let loop = 0;
  for (const title of titleMap) {
    for (let current = 0; current < title.number; ) {
      songs.push(createSongData(links[loop], title.name));
      current++;
      loop++;
    }
  }
  return Promise.all(songs);
}

// map from bad ziv title to our better title
const ZIV_TITLE_CORRECTIONS = {
  "CAN'T STOP FALLIN'IN LOVE": "CAN'T STOP FALLIN' IN LOVE",
  "MARIA (I believe... )": "MARIA (I believe...)",
  "魔法のたまご～心菜 ELECTRO POP edition～":
    "魔法のたまご ～心菜 ELECTRO POP edition～",
  "Lachryma(Re:Queen'M)": "Lachryma《Re:Queen’M》",
};

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
    remyLink: await getRemyLinkForSong(songLink),
  };
  return songData;
}

async function getRemyLinkForSong(songLink) {
  const dom = await requestQueue.add(() => JSDOM.fromURL(songLink.href));
  const remyLink = dom.window.document.querySelector('a[href*="remywiki.com"]');
  // @ts-ignore
  if (remyLink) return remyLink.href;
}

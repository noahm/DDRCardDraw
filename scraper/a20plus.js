// @ts-check
const { JSDOM } = require("jsdom");
const a20DataList = require("../src/songs/a20.json").songs;

const ZIV_EXTREME =
  "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=5156&show_notecounts=1&sort=&sort_order=asc";

JSDOM.fromURL(ZIV_EXTREME)
  .then(scrapeSongData)
  .then(writeDataFile);

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

function getChart(chartNode) {
  const difficulty = chartNode.firstChild.textContent;
  if (difficulty === "-") {
    return null;
  }
  const [step, freeze] = chartNode.lastElementChild.textContent.split(" / ");
  return {
    difficulty,
    step,
    shock: "0",
    freeze,
  };
}

const difficultyMap = {
  lightblue: "beginner",
  yellow: "basic",
  fuchsia: "difficult",
  green: "expert",
  purple: "challenge",
};

const stylePartation = 4;

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

function getCharts(chartNodes) {
  const charts = {};
  return chartNodes.reduce((acc, current, index) => {
    if (current.firstChild.textContent === "-") return acc;

    acc.push({
      lvl: +current.firstChild.textContent,
      style: index > stylePartation ? "double" : "single",
      diffClass: difficultyMap[current.classList[1]],
    });
    return acc;
  }, []);
}

function scrapeSongData(dom) {
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
  console.log(titleMap);

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
  return songs;
}

function createSongData(songLink, title) {
  const songRow = songLink.parentElement.parentElement;
  const artistNode = songRow.firstChild.lastChild.textContent.trim()
    ? songRow.firstChild.lastChild
    : songRow.firstChild.lastElementChild;
  const chartNodes = Array.from(songRow.children).slice(2);

  const a20Data = a20DataList.find(
    (target) => target.name.toLowerCase() === songLink.text.trim().toLowerCase()
  );
  const songData = {
    name: songLink.text.trim(),
    name_translation: getTranslationText(songLink),
    artist: artistNode.textContent.trim(),
    artist_translation: getTranslationText(artistNode),
    bpm: songRow.children[1].textContent.trim(),
    folder: title,
    charts: getCharts(chartNodes),
    jacket: "",
    ...a20Data,
  };
  return songData;
}

function writeDataFile(songs) {
  const fs = require("fs");
  const path = require("path");
  const prettier = require("prettier");

  const targetFile = path.join(__dirname, "../src/songs/a20plus.json");
  const existingData = JSON.parse(
    fs.readFileSync(targetFile, { encoding: "utf8" })
  );
  existingData.songs = songs;
  fs.writeFileSync(
    targetFile,
    prettier.format(JSON.stringify(existingData), { filepath: targetFile })
  );

  console.log(`Wrote ${songs.length} songs to a20plus.json`);
}

// @ts-check
const { JSDOM } = require('jsdom');

const ZIV_EXTREME = 'https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=81&show_notecounts=1&sort=&sort_order=asc';

JSDOM.fromURL(ZIV_EXTREME)
.then(scrapeSongData)
.then(writeDataFile);

const translationNodeQuery = 'span[onmouseover]';

function getTranslationText(node) {
  if (node.nodeName === '#text') {
    return '';
  }
  const translationNode = node.matches(translationNodeQuery) ? node : node.querySelector(translationNodeQuery);
  if (!translationNode) {
    return '';
  }
  return translationNode.attributes.onmouseover.value.slice(16, -2);
}

function getChart(chartNode) {
  const difficulty = chartNode.firstChild.textContent;
  if (difficulty === '-') {
    return null;
  }
  const [step, freeze] = chartNode.lastElementChild.textContent.split(' / ');
  return {
    difficulty,
    step,
    shock: '0',
    freeze,
  };
}

const difficultyMap = {
  lightblue: 'beginner',
  yellow: 'basic',
  fuchsia: 'difficult',
  green: 'expert',
  purple: 'challenge',
};

function getCharts(chartNodes) {
  const charts = {};
  for (const chartNode of chartNodes) {
    const difficultyName = difficultyMap[chartNode.classList[1]];
    charts[difficultyName] = getChart(chartNode);
  }
  return charts;
}

function scrapeSongData(dom) {
  const songs = [];
  for (const songLink of dom.window.document.querySelectorAll('a[href^="songdb.php"]')) {
    const songRow = songLink.parentElement.parentElement;
    const genreNode = songRow.firstChild.querySelector('span.rightfloat');
    const artistNode = songRow.firstChild.lastChild.textContent.trim() ? songRow.firstChild.lastChild : songRow.firstChild.lastElementChild;
    const chartNodes = Array.from(songRow.children).slice(2);

    const songData = {
      name: songLink.text.trim(),
      name_translation: getTranslationText(songLink),
      artist: artistNode.textContent.trim(),
      artist_translation: getTranslationText(artistNode),
      bpm: songRow.children[1].textContent.trim(),
      genre: genreNode ? getTranslationText(genreNode) || genreNode.textContent.trim() : '',
      single: getCharts(chartNodes.slice(0, 5)),
      double: getCharts(chartNodes.slice(5)),
    };

    songs.push(songData);
  }

  return songs;
}

function writeDataFile(songs) {
  const fs = require('fs');
  fs.writeFileSync('./extreme.json', JSON.stringify(songs, null, 2));
  console.log(`Wrote ${songs.length} songs to extreme.json`);
}

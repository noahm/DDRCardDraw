import { times } from './utils';

let drawingID = 0;

export function draw(songs, configData) {
  const numChartsToRandom = parseInt(configData.get('chartCount'), 10);
  const upperBound = parseInt(configData.get('upperBound'), 10);
  const lowerBound = parseInt(configData.get('lowerBound'), 10);
  const abbreviations = JSON.parse(configData.get('abbreviations'));
  const style = configData.get('style');
  // requested difficulties
  const difficulties = new Set(configData.getAll('difficulties'));
  // other options: usLocked, extraExclusive, removed, unlock
  const inclusions = new Set(configData.getAll('inclusions'));

  const validCharts = {};
  times(19, (n) => {
    validCharts[n.toString()] = [];
  });

  for (const currentSong of songs) {
    const charts = currentSong[style];
    // song-level filters
    if (
      (!inclusions.has('usLocked') && currentSong['us_locked']) ||
      (!inclusions.has('extraExclusive') && currentSong['extra_exclusive']) ||
      (!inclusions.has('removed') && currentSong['removed']) ||
      (!inclusions.has('tempUnlock') && currentSong['temp_unlock']) ||
      (!inclusions.has('unlock') && currentSong['unlock'])
    ) {
      continue;
    }

    for (const key in charts) {
      const chart = charts[key];

      // chart-level filters
      if (
        !chart || // no chart for difficulty
        !difficulties.has(key) || // don't want this difficulty
        (!inclusions.has('usLocked') && chart['us_locked']) || // chart is locked for us
        (!inclusions.has('extraExclusive') && chart['extra_exclusive']) || // chart is extra/final exclusive
        +chart.difficulty < lowerBound || // too easy
        +chart.difficulty > upperBound // too hard
      ) {
        continue;
      }

      // add chart to deck
      validCharts[chart.difficulty].push({
        'name': currentSong.name,
        'jacket': currentSong.jacket,
        'nameTranslation': currentSong.name_translation,
        'artist': currentSong.artist,
        'artistTranslation': currentSong.artist_translation,
        'bpm': currentSong.bpm,
        'difficulty': key,
        'level': chart.difficulty,
        'hasShock': parseInt(chart.shock, 10) > 0,
        'abbreviation': abbreviations[key],
      });
    }
  }

  const weighted = !!configData.get('weighted');
  let distribution = [];
  // build an array of possible levels to pick from
  for (let level = lowerBound; level <= upperBound; level++) {
    let weightAmount = 0;
    if (weighted) {
      weightAmount = parseInt(configData.get(`weight-${level}`), 10);
    } else {
      weightAmount = validCharts[level.toString()].length;
    }
    times(weightAmount, () => distribution.push(level));
  }

  const drawnCharts = [];

  while (drawnCharts.length < numChartsToRandom) {
    if (distribution.length === 0) {
      // no more songs available to pick in the requested range
      // returning fewer than requested songs
      break;
    }

    // first pick a difficulty
    const chosenDifficulty = distribution[Math.floor(Math.random() * distribution.length)];
    const selectableCharts = validCharts[chosenDifficulty.toString()];
    const randomIndex = Math.floor(Math.random() * selectableCharts.length);
    const randomChart = selectableCharts[randomIndex];

    if (randomChart) {
      drawnCharts.push(randomChart);
      // remove drawn chart so it cannot be re-drawn
      selectableCharts.splice(randomIndex, 1);
    }

    if (selectableCharts.length === 0) {
      // can't pick any more songs of this difficulty
      distribution = distribution.filter(n => n !== chosenDifficulty);
    }
  }

  drawingID += 1;
  return {
    id: drawingID,
    charts: drawnCharts,
    vetos: new Set(),
  };
}

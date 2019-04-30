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
  const occurrenceLimit = true;
  let distribution = [];
  let totalWeights = 0;
  let weightCaps = {};
  
  // build an array of possible levels to pick from
  for (let level = lowerBound; level <= upperBound; level++) {
    let weightAmount = 0;
    if (weighted) {
      weightAmount = parseInt(configData.get(`weight-${level}`), 10);
	weightCaps[level] = weightAmount;
	totalWeights += weightAmount;
    } else {
      weightAmount = validCharts[level.toString()].length;
    }
    times(weightAmount, () => distribution.push(level));
  }
  
  // If custom weights are used, weightCaps[level] will be the maximum number of cards of that level allowed in the card draw
  // e.g. For a 5-card draw, we increase the cap by 1 at every 100%/5 = 20% threshold,
  // so a level with a weight of 15% can only show up on at most 1 card, a level with a weight of 30% can only show up on at most 2 cards, etc.
  if (weighted) {
	  for (let level = lowerBound; level <= upperBound; level++) {
		let normalizedWeight = weightCaps[level]/totalWeights;
		weightCaps[level] = Math.ceil(normalizedWeight*numChartsToRandom);
	  }
  }

  const drawnCharts = [];
  let difficultyCounts = {};

  while (drawnCharts.length < numChartsToRandom) {
    if (distribution.length === 0) {
      // no more songs available to pick in the requested range
      // returning fewer than requested songs
      break;
    }

    // first pick a difficulty
    const chosenDifficulty = distribution[Math.floor(Math.random() * distribution.length)];
	// Eliminate difficulty if maximum number of occurrences has been reached
	if (weighted && occurrenceLimit && difficultyCounts[chosenDifficulty] === weightCaps[chosenDifficulty]){
		distribution = distribution.filter(function(level){
			return level !== chosenDifficulty;
		});
		continue;
	}
    const selectableCharts = validCharts[chosenDifficulty.toString()];
    const randomIndex = Math.floor(Math.random() * selectableCharts.length);
    const randomChart = selectableCharts[randomIndex];

    if (randomChart) {
      drawnCharts.push(randomChart);
      // remove drawn chart so it cannot be re-drawn
      selectableCharts.splice(randomIndex, 1);
	  if (!difficultyCounts[chosenDifficulty]){
		  difficultyCounts[chosenDifficulty] = 1;
	  }
	  else{
		  difficultyCounts[chosenDifficulty]++;
	  }
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

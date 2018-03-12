import songs from './ace.json';

let drawingID = 0;

export function draw(configData) {
  const numChartsToRandom = parseInt(configData.get('chartCount'), 10);
  const upperBound = parseInt(configData.get('upperBound'), 10);
  const lowerBound = parseInt(configData.get('lowerBound'), 10);
  const style = configData.get('style');
  // requested difficulties
  const difficulties = new Set(configData.getAll('difficulties'));
  // other options: usLocked, extraExclusive, removed, unlock
  const inclusions = new Set(configData.getAll('inclusions'));

  const validCharts = [];

  for (const currentSong of songs) {
    const charts = currentSong[style];

    if (!(inclusions.has('usLocked') && currentSong['us_locked']) &&
      !(inclusions.has('extraExclusive') && currentSong['extra_exclusive']) &&
      !(inclusions.has('removed') && currentSong['removed']) &&
      !(inclusions.has('unlock') && currentSong['unlock'])) {
      for (const key in charts) {
        const chart = charts[key];

        if ((difficulties.has(key) && chart !== null) &&
          (chart.difficulty >= lowerBound && chart.difficulty <= upperBound)) {
          validCharts.push({
            'name': currentSong.name,
            'nameTranslation': currentSong.name_translation,
            'artist': currentSong.artist,
            'artistTranslation': currentSong.artist_translation,
            'bpm': currentSong.bpm,
            'difficulty': key,
            'rating': chart.difficulty,
            'hasShock': parseInt(chart.shock, 10) > 0,
          });
        }
      }
    }
  }

  const drawnCharts = [];

  for (var j = 0; j < numChartsToRandom; j++) {
    const randomIndex = Math.floor(Math.random() * validCharts.length);
    const randomChart = validCharts[randomIndex];

    if (randomChart) {
      drawnCharts.push(randomChart);
      // remove drawn chart so it cannot be re-drawn
      validCharts.splice(randomIndex, 1);
    }
  }

  drawingID += 1;
  return {
    id: drawingID,
    charts: drawnCharts,
  };
}

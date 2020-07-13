import { GameData, Song, Chart } from "./models/SongData";
import { times } from "./utils";
import { DrawnChart, Drawing } from "./models/Drawing";
import { ConfigState } from "./config-state";

export function getDrawnChart(currentSong: Song, chart: Chart): DrawnChart {
  return {
    name: currentSong.name,
    jacket: chart.jacket || currentSong.jacket,
    nameTranslation: currentSong.name_translation,
    artist: currentSong.artist,
    artistTranslation: currentSong.artist_translation,
    bpm: currentSong.bpm,
    difficultyClass: chart.diffClass,
    level: chart.lvl,
    hasShock: !!chart.shock,
  };
}

/**
 * Used to give each drawing an auto-incrementing id
 */
let drawingID = 0;

/**
 * Produces a drawn set of charts given the song data and the user
 * input of the html form elements.
 * @param songs The song data (see `src/songs/`)
 * @param configData the data gathered by all form elements on the page, indexed by `name` attribute
 */
export function draw(gameData: GameData, configData: ConfigState): Drawing {
  const {
    chartCount: numChartsToRandom,
    upperBound,
    lowerBound,
    style,
    // requested difficulties
    difficulties,
    // other options: usLocked, extraExclusive, removed, unlock
    flags: inclusions,
    useWeights,
    forceDistribution,
    weights,
  } = configData;

  const validCharts: Record<string, Array<DrawnChart>> = {};
  times(gameData.meta.lvlMax, (n) => {
    validCharts[n.toString()] = [];
  });

  for (const currentSong of gameData.songs) {
    const charts = currentSong.charts.filter((c) => c.style === style);
    // song-level filters
    if (
      currentSong.flags &&
      !currentSong.flags.every((flag) => inclusions.has(flag))
    ) {
      continue;
    }

    for (const chart of charts) {
      // chart-level filters
      if (
        !difficulties.has(chart.diffClass) || // don't want this difficulty
        (chart.flags && !chart.flags.every((flag) => inclusions.has(flag))) || // doesn't exactly match our flags
        chart.lvl < lowerBound || // too easy
        chart.lvl > upperBound // too hard
      ) {
        continue;
      }

      // add chart to deck
      validCharts[chart.lvl].push(getDrawnChart(currentSong, chart));
    }
  }

  /**
   * the "deck" of difficulty levels to pick from
   */
  let distribution: Array<number> = [];
  /**
   * Total amount of weight used, so we can determine expected outcome below
   */
  let totalWeights = 0;
  /**
   * The number of charts we can expect to draw of each level
   */
  const expectedDrawPerLevel: Record<string, number> = {};

  // build an array of possible levels to pick from
  for (let level = lowerBound; level <= upperBound; level++) {
    let weightAmount = 0;
    if (useWeights) {
      weightAmount = weights[level];
      expectedDrawPerLevel[level.toString()] = weightAmount;
      totalWeights += weightAmount;
    } else {
      weightAmount = validCharts[level.toString()].length;
    }
    times(weightAmount, () => distribution.push(level));
  }

  // If custom weights are used, expectedDrawsPerLevel[level] will be the maximum number
  // of cards of that level allowed in the card draw.
  // e.g. For a 5-card draw, we increase the cap by 1 at every 100%/5 = 20% threshold,
  // so a level with a weight of 15% can only show up on at most 1 card, a level with
  // a weight of 30% can only show up on at most 2 cards, etc.
  if (useWeights && forceDistribution) {
    for (let level = lowerBound; level <= upperBound; level++) {
      let normalizedWeight =
        expectedDrawPerLevel[level.toString()] / totalWeights;
      expectedDrawPerLevel[level] = Math.ceil(
        normalizedWeight * numChartsToRandom
      );
    }
  }

  const drawnCharts = [];
  /**
   * Record of how many songs of each difficulty have been drawn so far
   */
  const difficultyCounts: Record<string, number> = {};

  while (drawnCharts.length < numChartsToRandom) {
    if (distribution.length === 0) {
      // no more songs available to pick in the requested range
      // will be returning fewer than requested number of charts
      break;
    }

    // first pick a difficulty
    const chosenDifficulty =
      distribution[Math.floor(Math.random() * distribution.length)];
    const selectableCharts = validCharts[chosenDifficulty.toString()];
    const randomIndex = Math.floor(Math.random() * selectableCharts.length);
    const randomChart = selectableCharts[randomIndex];

    if (randomChart) {
      drawnCharts.push(randomChart);
      // remove drawn chart so it cannot be re-drawn
      selectableCharts.splice(randomIndex, 1);
      if (!difficultyCounts[chosenDifficulty]) {
        difficultyCounts[chosenDifficulty] = 1;
      } else {
        difficultyCounts[chosenDifficulty]++;
      }
    }

    // check if maximum number of expected occurrences of this level of chart has been reached
    const reachedExpected =
      forceDistribution &&
      difficultyCounts[chosenDifficulty.toString()] ===
        expectedDrawPerLevel[chosenDifficulty.toString()];

    if (selectableCharts.length === 0 || reachedExpected) {
      // can't pick any more songs of this difficulty
      distribution = distribution.filter((n) => n !== chosenDifficulty);
    }
  }

  drawingID += 1;
  return {
    id: drawingID,
    charts: drawnCharts,
    bans: [],
    protects: [],
    pocketPicks: [],
  };
}

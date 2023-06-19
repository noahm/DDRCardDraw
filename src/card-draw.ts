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
    drawGroup: chart.drawGroup,
    flags: (chart.flags || []).concat(currentSong.flags || []),
    song: currentSong,
  };
}

/**
 * Used to give each drawing an auto-incrementing id
 */
let drawingID = 0;

/** returns true if song matches configured flags */
export function songIsValid(
  config: ConfigState,
  song: Song,
  forPocketPick = false
): boolean {
  if (forPocketPick && !config.constrainPocketPicks) {
    return true;
  }
  return !song.flags || song.flags.every((f) => config.flags.has(f));
}

/** returns true if chart matches configured difficulty/style/lvl/flags */
export function chartIsValid(
  config: ConfigState,
  chart: Chart,
  forPocketPick = false
): boolean {
  if (forPocketPick && !config.constrainPocketPicks) {
    return chart.style === config.style;
  }
  let groupConstraintSatisfied = false;
  if (config.drawGroups.length == 0) {
    groupConstraintSatisfied = 
      chart.lvl >= config.lowerBound &&
      chart.lvl <= config.upperBound;
  }
  else if (chart.drawGroup) {
    groupConstraintSatisfied = config.drawGroups.includes(chart.drawGroup);
  }
  return (
    chart.style === config.style &&
    config.difficulties.has(chart.diffClass) &&
    groupConstraintSatisfied && 
    (!chart.flags || chart.flags.every((f) => config.flags.has(f)))
  );
}

export function* eligibleCharts(config: ConfigState, songs: Song[]) {
  for (const currentSong of songs) {
    if (!songIsValid(config, currentSong)) {
      continue;
    }
    const charts = currentSong.charts.filter((c) => c.style === config.style);

    for (const chart of charts) {
      if (!chartIsValid(config, chart)) {
        continue;
      }

      // add chart to deck
      yield getDrawnChart(currentSong, chart);
    }
  }
}

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
    drawGroups,
    style,
    useWeights,
    useDrawGroups,
    forceDistribution,
    weights,
    groupSongsAt,
  } = configData;

  /** all charts we will consider to be valid for this draw */
  const validCharts = new Map<string, Array<DrawnChart>>();
  console.log(drawGroups)
  
  if (useDrawGroups && drawGroups.length > 0)
  {
    gameData.meta.drawGroups?.map((g) => validCharts.set(g, []));
    for (const chart of eligibleCharts(configData, gameData.songs)) {
      if (chart.drawGroup)
      {
        validCharts.get(chart.drawGroup)!.push(chart);
      }
    }
  }
  else
  {
    times(gameData.meta.lvlMax, (n) => {
      validCharts.set(n.toString(), []);
    });
    for (const chart of eligibleCharts(configData, gameData.songs)) {
      let chartLevel = chart.level;
      // merge in higher difficulty charts into a single group, if configured to do so
      if (useWeights && groupSongsAt && groupSongsAt < chartLevel) {
        chartLevel = groupSongsAt;
      }
      validCharts.get(chartLevel.toString())!.push(chart);
    }
  }
  console.log(validCharts)


  /**
   * the "deck" of difficulty levels to pick from
   */
  let distribution: Array<string> = [];
  /**
   * Total amount of weight used, so we can determine expected outcome below
   */
  let totalWeights = 0;
  /**
   * The number of charts we can expect to draw of each level
   */
  const expectedDrawPerLevel: Record<string, number> = {};

  // build an array of possible levels/groups to pick from
  let groups: string[] = [];
  if (useDrawGroups && drawGroups.length > 0) {
    groups = Array.from(drawGroups);
  }
  else {
    groups = [...Array(upperBound+1).keys()].slice(lowerBound).map((v) => v.toString());
  }

  for (let groupIndex in groups) {
    let weightAmount = 0;
    let group = groups[groupIndex];
    if (useWeights) {
      weightAmount = weights[groupIndex];
      expectedDrawPerLevel[group] = weightAmount;
      totalWeights += weightAmount;
    } else {
      weightAmount = validCharts.get(group)!.length;
    }
    times(weightAmount, () => distribution.push(group));
  }
  console.log(weights)

  // If custom weights are used, expectedDrawsPerLevel[level] will be the maximum number
  // of cards of that level allowed in the card draw.
  // e.g. For a 5-card draw, we increase the cap by 1 at every 100%/5 = 20% threshold,
  // so a level with a weight of 15% can only show up on at most 1 card, a level with
  // a weight of 30% can only show up on at most 2 cards, etc.
  if (useWeights && forceDistribution) {
    for (let group in groups) {
      let normalizedWeight =
        expectedDrawPerLevel[group] / totalWeights;
      expectedDrawPerLevel[group] = Math.ceil(
        normalizedWeight * numChartsToRandom
      );
    }
  }

  const drawnCharts: DrawnChart[] = [];
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
    let chosenDifficulty =
      distribution[Math.floor(Math.random() * distribution.length)];
    if (useWeights && !useDrawGroups && groupSongsAt && groupSongsAt < parseInt(chosenDifficulty)) {
      chosenDifficulty = groupSongsAt.toString();
    }
    const selectableCharts = validCharts.get(chosenDifficulty)!;
    const randomIndex = Math.floor(Math.random() * selectableCharts.length);
    const randomChart = selectableCharts[randomIndex];

    if (randomChart) {
      // Give this random chart a unique id within this drawing
      randomChart.id = drawnCharts.length;
      // Save it in our list of drawn charts
      drawnCharts.push(randomChart);
      // remove drawn chart from deck so it cannot be re-drawn
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

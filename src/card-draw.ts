import { nanoid } from "nanoid";
import { GameData, Song, Chart } from "./models/SongData";
import { times } from "./utils";
import { DrawnChart, EligibleChart, Drawing } from "./models/Drawing";
import { ConfigState } from "./config-state";
import { getDifficultyColor } from "./hooks/useDifficultyColor";
import { getAvailableLevels, getDiffAbbr } from "./game-data-utils";

export function getDrawnChart(
  gameData: GameData,
  currentSong: Song,
  chart: Chart,
): EligibleChart {
  return {
    name: currentSong.name,
    jacket: chart.jacket || currentSong.jacket,
    nameTranslation: currentSong.name_translation,
    artist: currentSong.artist,
    artistTranslation: currentSong.artist_translation,
    bpm: chart.bpm || currentSong.bpm,
    level: chart.sanbaiTier || chart.lvl,
    drawGroup: chart.drawGroup,
    flags: (chart.flags || []).concat(currentSong.flags || []),
    song: currentSong,
    // Fill in variant data per game
    diffAbbr: getDiffAbbr(gameData, chart.diffClass),
    diffColor: getDifficultyColor(gameData, chart.diffClass),
  };
}

/** returns true if song matches configured flags */
export function songIsValid(
  config: ConfigState,
  song: Song,
  forPocketPick = false,
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
  forPocketPick = false,
): boolean {
  if (forPocketPick && !config.constrainPocketPicks) {
    return chart.style === config.style;
  }
  const levelMetric = chart.drawGroup || chart.lvl;
  return (
    chart.style === config.style &&
    config.difficulties.has(chart.diffClass) &&
    levelMetric >= config.lowerBound &&
    levelMetric <= config.upperBound &&
    (!chart.flags || chart.flags.every((f) => config.flags.has(f)))
  );
}

export function* eligibleCharts(config: ConfigState, gameData: GameData) {
  const buckets = getBuckets(config, getAvailableLevels(gameData, true));
  for (const currentSong of gameData.songs) {
    if (!songIsValid(config, currentSong)) {
      continue;
    }
    const charts = currentSong.charts.filter((c) => c.style === config.style);

    for (const chart of charts) {
      if (!chartIsValid(config, chart)) {
        continue;
      }
      if (config.useWeights) {
        const bucketIdx = bucketIndexForLvl(
          chart.sanbaiTier || chart.lvl,
          buckets,
        );
        if (bucketIdx === null || !config.weights[bucketIdx]) {
          continue;
        }
      }

      // add chart to deck
      yield getDrawnChart(gameData, currentSong, chart);
    }
  }
}

export type LevelRangeBucket = [low: number, high: number];
export type BucketLvlRanges = Array<LevelRangeBucket>;
export type LvlRanges = Array<number> | BucketLvlRanges;

/**
 *
 * @param cfg
 * @param availableLvls prefer granular
 * @returns
 */
export function getBuckets(
  cfg: Pick<
    ConfigState,
    "useWeights" | "probabilityBucketCount" | "upperBound" | "lowerBound"
  >,
  availableLvls: Array<number>,
): LvlRanges {
  const { useWeights, probabilityBucketCount, upperBound, lowerBound } = cfg;
  const absoluteRangeSize = upperBound - lowerBound + 1;
  if (!useWeights || !probabilityBucketCount) {
    return times(absoluteRangeSize, (n) => n - 1 + lowerBound);
  }
  const bucketRangeSize = absoluteRangeSize / probabilityBucketCount;
  let lvlIndex = availableLvls.indexOf(lowerBound);
  return times<LevelRangeBucket>(probabilityBucketCount, () => {
    const low = availableLvls[lvlIndex];

    while (
      lvlIndex < availableLvls.length &&
      availableLvls[lvlIndex] < low + bucketRangeSize &&
      availableLvls[lvlIndex] < upperBound + 1
    ) {
      lvlIndex++;
    }

    return [low, availableLvls[lvlIndex - 1]];
  });
}

function bucketIndexForLvl(lvl: number, buckets: LvlRanges) {
  for (let idx = 0; idx < buckets.length; idx++) {
    const bucket = buckets[idx];
    if (typeof bucket === "number") {
      if (bucket === lvl) return idx;
    } else {
      if (lvl >= bucket[0] && lvl <= bucket[1]) {
        return idx;
      }
    }
  }
  return null;
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
    useWeights,
    forceDistribution,
    weights,
    defaultPlayersPerDraw,
  } = configData;

  /** all charts we will consider to be valid for this draw, mapped by bucket index */
  const validCharts = new Map<number, Array<EligibleChart>>();

  const availableLvls = getAvailableLevels(gameData, true);
  const buckets = getBuckets(configData, availableLvls);

  for (const chart of eligibleCharts(configData, gameData)) {
    const bucketIdx = bucketIndexForLvl(
      chart.drawGroup || chart.level,
      buckets,
    );
    if (!bucketIdx) continue;
    const chartsInBucket = validCharts.get(bucketIdx);
    if (chartsInBucket) {
      chartsInBucket.push(chart);
    } else {
      validCharts.set(bucketIdx, [chart]);
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
   * Maximum number of charts we can expect to draw of each level. Only used with `forceDistribution`
   */
  const maxDrawPerLevel = new Map<number, number>();
  /**
   * List of difficulty levels that must be picked first, to meet minimums. Only used with `forceDistribution`
   */
  const requiredDrawDifficulties: number[] = [];

  for (const bucketIndex of weights.keys()) {
    let weightAmount = 0;
    if (useWeights) {
      weightAmount = weights[bucketIndex] || 0;
      totalWeights += weightAmount;
    } else {
      const chartsInBucket = validCharts.get(bucketIndex);
      weightAmount = chartsInBucket?.length || 0;
    }
    times(weightAmount, () => distribution.push(bucketIndex));
  }

  // If custom weights are used, expectedDrawsPerLevel[level] will be the maximum number
  // of cards of that level allowed in the card draw.
  // e.g. For a 5-card draw, we increase the cap by 1 at every 100%/5 = 20% threshold,
  // so a level with a weight of 15% can only show up on at most 1 card, a level with
  // a weight of 30% can only show up on at most 2 cards, etc.
  if (useWeights && forceDistribution) {
    for (const bucketLvl of validCharts.keys()) {
      const normalizedWeight = (weights[bucketLvl] || 0) / totalWeights;
      const maxForThisLevel = Math.ceil(normalizedWeight * numChartsToRandom);
      maxDrawPerLevel.set(bucketLvl, maxForThisLevel);
      // setup minimum draws
      for (let i = 1; i < maxForThisLevel; i++) {
        requiredDrawDifficulties.push(bucketLvl);
      }
    }
  }

  const drawnCharts: DrawnChart[] = [];
  /**
   * Record of how many songs of each bucket lvl have been drawn so far
   */
  const difficultyCounts = new Map<number, number>();

  while (drawnCharts.length < numChartsToRandom) {
    if (distribution.length === 0) {
      // no more songs available to pick in the requested range
      // will be returning fewer than requested number of charts
      break;
    }

    // first pick a difficulty (with priority to minimum draws)
    let chosenBucketLvl = requiredDrawDifficulties.shift();
    if (!chosenBucketLvl) {
      chosenBucketLvl =
        distribution[Math.floor(Math.random() * distribution.length)];
    }
    const selectableCharts = validCharts.get(chosenBucketLvl);
    if (!selectableCharts) {
      // something bad happened?!
      break;
    }
    const randomIndex = Math.floor(Math.random() * selectableCharts.length);
    const randomChart = selectableCharts[randomIndex];

    if (randomChart) {
      // Save it in our list of drawn charts
      drawnCharts.push({
        ...randomChart,
        // Give this random chart a unique id within this drawing
        id: `drawn_chart-${nanoid(5)}`,
      });
      // remove drawn chart from deck so it cannot be re-drawn
      selectableCharts.splice(randomIndex, 1);
      difficultyCounts.set(
        chosenBucketLvl,
        (difficultyCounts.get(chosenBucketLvl) || 0) + 1,
      );
    }

    // check if maximum number of expected occurrences of this level of chart has been reached
    const reachedExpected =
      forceDistribution &&
      difficultyCounts.get(chosenBucketLvl) ===
        maxDrawPerLevel.get(chosenBucketLvl);

    if (selectableCharts.length === 0 || reachedExpected) {
      // can't pick any more songs of this difficulty
      distribution = distribution.filter((n) => n !== chosenBucketLvl);
    }
  }

  return {
    id: `draw-${nanoid(10)}`,
    charts: configData.sortByLevel
      ? drawnCharts.sort((a, b) => a.level - b.level)
      : shuffle(drawnCharts),
    players: times(defaultPlayersPerDraw, () => ""),
    bans: [],
    protects: [],
    pocketPicks: [],
    winners: [],
  };
}

/**
 * is this an accurate F-Y shuffle? who knows!?!
 */
function shuffle<Item>(arr: Array<Item>): Array<Item> {
  const ret = arr.slice();
  for (let i = 0; i < ret.length; i++) {
    const randomUpcomingIndex =
      i + Math.floor(Math.random() * (ret.length - i));
    const currentItem = ret[i];
    ret[i] = ret[randomUpcomingIndex];
    ret[randomUpcomingIndex] = currentItem;
  }
  return ret;
}

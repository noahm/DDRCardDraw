import { nanoid } from "nanoid";
import { GameData, Song, Chart } from "./models/SongData";
import { chunkInPieces, pickRandomItem, rangeI, shuffle, times } from "./utils";
import { CountingSet } from "./utils/counting-set";
import { DefaultingMap } from "./utils/defaulting-set";
import { Fraction } from "./utils/fraction";
import { DrawnChart, EligibleChart, Drawing } from "./models/Drawing";
import { ConfigState } from "./config-state";
import { getDifficultyColor } from "./hooks/useDifficultyColor";
import {
  chartLevelOrTier,
  getAvailableLevels,
  getDiffAbbr,
} from "./game-data-utils";

function clampToNearest(incr: number, n: number, clamp: (n: number) => number) {
  const multor = Math.round(1 / incr);
  let ret = clamp(n * multor) / multor;
  if (Number.isInteger(n) && clamp === Math.floor) {
    ret -= incr;
  }
  return ret;
}

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
    level: chart.lvl,
    granularLevel: chart.sanbaiTier,
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
  const buckets = Array.from(
    getBuckets(config, getAvailableLevels(gameData, config.useGranularLevels)),
  );
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
          chartLevelOrTier(chart, config.useGranularLevels),
          buckets,
        );
        if (bucketIdx === null) {
          // this chart is completely outside the difficulty range
          // (shouldn't hit, because `chartIsValid` above filters based on the raw range)
          continue;
        }
        if (!config.weights[bucketIdx]) {
          // this chart belongs to a bucket with 0 or null weight applied
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
export type LvlRanges = Array<number | LevelRangeBucket>;

/**
 *
 * @param cfg
 * @param availableLvls prefer granular
 * @returns
 */
export function* getBuckets(
  cfg: Pick<
    ConfigState,
    | "useWeights"
    | "probabilityBucketCount"
    | "upperBound"
    | "lowerBound"
    | "useGranularLevels"
  >,
  availableLvls: Array<number>,
): Generator<LevelRangeBucket | number, void> {
  const { useWeights, probabilityBucketCount, upperBound, lowerBound } = cfg;
  const absoluteRangeSize = upperBound - lowerBound + 1;
  if (!useWeights || !probabilityBucketCount) {
    for (let n = lowerBound; n <= upperBound; n++) {
      yield n;
    }
    return;
  }
  if (!cfg.useGranularLevels) {
    const levels = Array.from(rangeI(lowerBound, upperBound));
    for (const chunk of chunkInPieces(probabilityBucketCount, levels)) {
      yield [chunk[0], chunk[chunk.length - 1]];
    }
    return;
  }

  const bucketWidth = new Fraction(absoluteRangeSize, probabilityBucketCount);
  let upperIndex: number | undefined = availableLvls.indexOf(upperBound + 1);
  if (upperIndex === -1) {
    upperIndex = undefined;
  }
  // TODO add this to the data file spec
  const incrementGuess = availableLvls[1] - availableLvls[0];
  const lowerBoundF = new Fraction(lowerBound);
  const nudge = new Fraction(1, 1000);
  for (let i = 0; i < probabilityBucketCount; i++) {
    const bucketBottom = bucketWidth.mult(new Fraction(i)).add(lowerBoundF);
    const bucketTop = bucketBottom.add(bucketWidth);
    yield [
      clampToNearest(incrementGuess, bucketBottom.valueOf(), Math.ceil),
      clampToNearest(
        incrementGuess,
        bucketTop.sub(nudge).valueOf(),
        Math.floor,
      ),
    ];
  }
}

/**
 * Given a chart's difficulty level (or tier number), returns the appropriate index for
 * its appropriate bucket within the given buckets array, or null if it doesn't fit into
 * the given buckets
 * @param lvl the difficulty level of a chart, or a tier number
 * @param buckets computed set of difficulty buckets
 * @returns index of a bucket within `buckets` or null
 */
function bucketIndexForLvl(lvl: number, buckets: LvlRanges): number | null {
  for (let idx = 0; idx < buckets.length; idx++) {
    const bucket = buckets[idx];
    if (typeof bucket === "number") {
      if (bucket === Math.floor(lvl)) return idx;
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
    useGranularLevels,
  } = configData;

  /** all charts we will consider to be valid for this draw, mapped by bucket index */
  const validCharts = new DefaultingMap<number, Array<EligibleChart>>(() => []);

  const availableLvls = getAvailableLevels(gameData, useGranularLevels);
  const buckets = Array.from(getBuckets(configData, availableLvls));

  for (const chart of eligibleCharts(configData, gameData)) {
    const bucketIdx = useWeights
      ? bucketIndexForLvl(chartLevelOrTier(chart, useGranularLevels), buckets)
      : 0; // outside of weights mode we just put all songs into one shared bucket
    if (bucketIdx === null) continue;
    validCharts.get(bucketIdx).push(chart);
  }

  /**
   * a "deck" of a probability bucket indexes. as each bucket has weight added to it,
   * we add more copies of its index to this deck, making it more likely to be drawn
   * during the actual card draw process later on. by default this is just a deck referencing
   * a single bucket, which is the only bucket used outside of `useWeights` mode.
   */
  let bucketDistribution: Array<number> = [0];
  /**
   * Maximum number of charts we can expect to draw for each bucket index. Only used with `forceDistribution`
   */
  const maxDrawPerBucket = new Map<number, number>();
  /**
   * List of bucket indexes that must be picked first, to meet minimums. Only used with `forceDistribution`
   */
  const requiredDrawIndexes: number[] = [];

  if (useWeights) {
    // build a distribution based on the weights used for each bucket
    bucketDistribution = [];
    for (const bucketIndex of validCharts.keys()) {
      const weightAmount = weights[bucketIndex] || 0;
      // add the appropriate amount of "cards" representing this bucket to the overall distro
      times(weightAmount, () => bucketDistribution.push(bucketIndex));
    }

    // If we are focing distribution, maxDrawPerBucket[level] will be the maximum number
    // of cards of that level allowed in the card draw.
    // e.g. For a 5-card draw, we increase the cap by 1 at every 100%/5 = 20% threshold,
    // so a level with a weight of 15% can only show up on at most 1 card, a level with
    // a weight of 30% can only show up on at most 2 cards, etc.
    if (forceDistribution) {
      /**
       * Total amount of weight used, so we can determine expected outcomes
       */
      const totalWeightUsed = weights.reduce<number>(
        (sum, current) => sum + (current || 0),
        0,
      );
      for (const bucketIdx of validCharts.keys()) {
        const normalizedWeight = (weights[bucketIdx] || 0) / totalWeightUsed;
        const maxForThisBucket = Math.ceil(
          normalizedWeight * numChartsToRandom,
        );
        maxDrawPerBucket.set(bucketIdx, maxForThisBucket);
        // setup minimum draws
        for (let i = 1; i < maxForThisBucket; i++) {
          requiredDrawIndexes.push(bucketIdx);
        }
      }
    }
  }

  const drawnCharts: DrawnChart[] = [];
  /**
   * Record of how many songs of each bucket index have been drawn so far
   */
  const difficultyCounts = new CountingSet<number>();

  // OK, setup work is done, here's whre we actually draw the cards!
  while (drawnCharts.length < numChartsToRandom) {
    if (bucketDistribution.length === 0) {
      // no more songs available to pick in the requested range
      // will be returning fewer than requested number of charts
      break;
    }

    // first pick a difficulty (with priority to minimum draws)
    let chosenBucketIdx = requiredDrawIndexes.shift();
    if (chosenBucketIdx === undefined) {
      [, chosenBucketIdx] = pickRandomItem(bucketDistribution);
    }
    if (chosenBucketIdx === undefined) {
      // nothing left to draw
      break;
    }
    const selectableCharts = validCharts.get(chosenBucketIdx);
    if (!selectableCharts) {
      // something bad happened?!
      break;
    }
    const [randomIndex, randomChart] = pickRandomItem(selectableCharts);

    if (randomChart) {
      // Save it in our list of drawn charts
      drawnCharts.push({
        ...randomChart,
        // Give this random chart a unique id within this drawing
        id: `drawn_chart-${nanoid(5)}`,
      });
      // remove drawn chart from deck so it cannot be re-drawn
      selectableCharts.splice(randomIndex, 1);
      difficultyCounts.add(chosenBucketIdx);
    }

    // check if maximum number of expected occurrences of this level of chart has been reached
    const reachedExpected =
      forceDistribution &&
      difficultyCounts.get(chosenBucketIdx) ===
        maxDrawPerBucket.get(chosenBucketIdx);

    if (selectableCharts.length === 0 || reachedExpected) {
      // can't pick any more songs of this difficulty
      bucketDistribution = bucketDistribution.filter(
        (n) => n !== chosenBucketIdx,
      );
    }
  }

  return {
    id: `draw-${nanoid(10)}`,
    charts: configData.sortByLevel
      ? drawnCharts.sort(
          (a, b) =>
            chartLevelOrTier(a, useGranularLevels, false) -
            chartLevelOrTier(b, useGranularLevels, false),
        )
      : shuffle(drawnCharts),
    players: times(defaultPlayersPerDraw, () => ""),
    bans: [],
    protects: [],
    pocketPicks: [],
    winners: [],
  };
}

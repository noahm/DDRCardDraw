import { nanoid } from "nanoid";
import { GameData, Song, Chart } from "./models/SongData";
import { shuffle, times } from "./utils";
import { CountingSet, ReadonlyCountingSet } from "./utils/counting-set";
import { DefaultingMap } from "./utils/defaulting-set";
import {
  DrawnChart,
  EligibleChart,
  Drawing,
  PlayerPickPlaceholder,
  CHART_PLACEHOLDER,
  CHART_DRAWN,
} from "./models/Drawing";
import { ConfigState } from "./config-state";
import { getDifficultyColor } from "./hooks/useDifficultyColor";
import { chartLevelOrTier, getDiffAbbr } from "./game-data-utils";
import {
  DrawBucket,
  DrawPlan,
  bucketForLvl,
  getDrawBuckets,
  planDraw,
} from "./draw-buckets";

export function getDrawnChart(
  gameData: GameData,
  currentSong: Song,
  chart: Chart,
): EligibleChart {
  return {
    cardVariant: gameData.meta.cardVariant,
    name: currentSong.name,
    jacket: chart.jacket || currentSong.jacket,
    nameTranslation: currentSong.name_translation,
    artist: currentSong.artist,
    artistTranslation: currentSong.artist_translation,
    bpm: chart.bpm || currentSong.bpm,
    level: chart.lvl,
    granularLevel: chart.sanbaiTier,
    maxScore: chart.maxScore,
    drawGroup: chart.drawGroup,
    flags: (chart.flags || []).concat(currentSong.flags || []),
    extras: (chart.extras || []).concat(currentSong.extras || []),
    song: currentSong,
    dateAdded: currentSong.date_added,
    folder: currentSong.folder,
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
  if (
    config.cutoffDate &&
    song.date_added &&
    song.date_added > config.cutoffDate
  ) {
    return false;
  }
  return (
    (!song.folder ||
      !config.folders.length ||
      config.folders.includes(song.folder)) &&
    (!song.flags || song.flags.every((f) => config.flags.includes(f)))
  );
}

/** returns true if chart matches every configured filter except difficulty lvl */
function chartMatchesFilters(config: ConfigState, chart: Chart): boolean {
  if (config.useGranularLevels && !chart.sanbaiTier) {
    return false;
  }
  return (
    chart.style === config.style &&
    config.difficulties.includes(chart.diffClass) &&
    (!chart.flags || chart.flags.every((f) => config.flags.includes(f)))
  );
}

/**
 * The bucket a chart would be drawn from, or undefined if its lvl doesn't land
 * in any bucket that carries weight. This is the only place difficulty lvl is
 * used to include/exclude a chart, in every mode.
 */
function drawableBucketForChart(
  config: ConfigState,
  buckets: ReadonlyArray<DrawBucket>,
  chart: Chart,
): DrawBucket | undefined {
  const bucket = bucketForLvl(
    chartLevelOrTier(chart, config.useGranularLevels),
    buckets,
  );
  return bucket && bucket.weight > 0 ? bucket : undefined;
}

/** returns true if chart matches configured difficulty/style/lvl/flags */
export function chartIsValid(
  config: ConfigState,
  buckets: ReadonlyArray<DrawBucket>,
  chart: Chart,
  forPocketPick = false,
): boolean {
  if (forPocketPick && !config.constrainPocketPicks) {
    return chart.style === config.style;
  }
  return (
    chartMatchesFilters(config, chart) &&
    !!drawableBucketForChart(config, buckets, chart)
  );
}

/** every drawable chart, paired with the bucket it belongs to */
function* bucketedEligibleCharts(
  config: ConfigState,
  gameData: GameData,
  buckets: ReadonlyArray<DrawBucket>,
): Generator<readonly [DrawBucket, EligibleChart], void> {
  for (const currentSong of gameData.songs) {
    if (!songIsValid(config, currentSong)) {
      continue;
    }
    for (const chart of currentSong.charts) {
      if (!chartMatchesFilters(config, chart)) {
        continue;
      }
      const bucket = drawableBucketForChart(config, buckets, chart);
      if (!bucket) {
        continue;
      }
      yield [bucket, getDrawnChart(gameData, currentSong, chart)] as const;
    }
  }
}

export function* eligibleCharts(
  config: ConfigState,
  gameData: GameData,
  buckets: ReadonlyArray<DrawBucket> = getDrawBuckets(config, gameData),
) {
  for (const [, chart] of bucketedEligibleCharts(config, gameData, buckets)) {
    yield chart;
  }
}

/**
 * How many charts land in each bucket, keyed by bucket key. Zero-weight buckets
 * are counted too, so the controls can show what a bucket would contribute if
 * it were given any weight.
 */
export function countChartsPerBucket(
  config: ConfigState,
  gameData: GameData,
  buckets: ReadonlyArray<DrawBucket>,
): Map<string, number> {
  const counts = new Map<string, number>(
    buckets.map((bucket) => [bucket.key, 0]),
  );
  for (const currentSong of gameData.songs) {
    if (!songIsValid(config, currentSong)) {
      continue;
    }
    for (const chart of currentSong.charts) {
      if (!chartMatchesFilters(config, chart)) {
        continue;
      }
      const bucket = bucketForLvl(
        chartLevelOrTier(chart, config.useGranularLevels),
        buckets,
      );
      if (bucket) {
        counts.set(bucket.key, (counts.get(bucket.key) || 0) + 1);
      }
    }
  }
  return counts;
}

export type DrawingMeta = Pick<Drawing, "meta">;
export type StartingPoint = DrawingMeta & { charts?: Drawing["charts"] };

const artistDrawBlocklist = new Set();

/**
 * Executes a draw plan against the charts available in each bucket.
 *
 * Every bucket's minimum is covered first, then the remainder of the drawing is
 * filled at random weighted by the plan's deck. Buckets that run dry (or hit
 * their ceiling) drop out of the deck, so the draw always terminates and simply
 * returns fewer charts than asked for when the pool can't supply them.
 */
function drawFromPools(
  plan: DrawPlan,
  pools: Iterable<readonly [string, Array<EligibleChart>]>,
  /** charts already in the drawing, counted against each bucket's share */
  seeded: ReadonlyCountingSet<string>,
): Array<EligibleChart> {
  const drawn: Array<EligibleChart> = [];
  const drawnPerBucket = new CountingSet<string>();
  /** local copies, so a chart can never be drawn twice */
  const remaining = new Map<string, Array<EligibleChart>>();
  for (const [key, charts] of pools) {
    remaining.set(key, charts.slice());
  }

  let seededTotal = 0;
  for (const [key, count] of seeded.valuesWithCount()) {
    drawnPerBucket.add(key, count);
    seededTotal += count;
  }
  const stillToDraw = plan.total - seededTotal;

  /** returns false if the bucket has nothing left to give */
  function drawFrom(bucketKey: string): boolean {
    const allocation = plan.allocations.get(bucketKey);
    if (!allocation || drawnPerBucket.get(bucketKey) >= allocation.max) {
      return false;
    }
    const pool = remaining.get(bucketKey);
    if (!pool || !pool.length) {
      return false;
    }
    const [chart] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    drawn.push(chart);
    drawnPerBucket.add(bucketKey);
    return true;
  }

  // cover minimums first, in a random order so that an over-subscribed set of
  // minimums doesn't consistently starve the same buckets. anything a seeded
  // chart already satisfies doesn't need drawing again
  const required: Array<string> = [];
  for (const [bucketKey, { min }] of plan.allocations) {
    times(Math.max(0, min - seeded.get(bucketKey)), () =>
      required.push(bucketKey),
    );
  }
  for (const bucketKey of shuffle(required)) {
    if (drawn.length >= stillToDraw) {
      break;
    }
    drawFrom(bucketKey);
  }

  // then fill the rest of the drawing at random
  let deck = plan.deck;
  while (drawn.length < stillToDraw && deck.length) {
    const bucketKey = deck[Math.floor(Math.random() * deck.length)];
    if (!drawFrom(bucketKey)) {
      deck = deck.filter((key) => key !== bucketKey);
    }
  }

  return drawn;
}

/**
 * Produces a drawn set of charts given the song data and the user
 * input of the html form elements.
 * @param songs The song data (see `src/songs/`)
 * @param configData the data gathered by all form elements on the page, indexed by `name` attribute
 */
export function draw(
  gameData: GameData,
  configData: ConfigState,
  startPoint: StartingPoint,
) {
  const { useGranularLevels } = configData;

  const buckets = getDrawBuckets(configData, gameData);
  const plan = planDraw(buckets, configData);

  /** all charts we consider valid for this draw, grouped by bucket */
  const pools = new DefaultingMap<string, Array<EligibleChart>>(() => []);
  for (const [bucket, chart] of bucketedEligibleCharts(
    configData,
    gameData,
    buckets,
  )) {
    if (artistDrawBlocklist.has(chart.artist)) continue;
    pools.get(bucket.key).push(chart);
  }

  // charts already in the set fill part of their bucket's share, and mustn't be
  // drawn a second time
  const preSeededDrawnCharts =
    startPoint.charts?.filter((c) => c.type === CHART_DRAWN) || [];
  const seeded = new CountingSet<string>();
  for (const chart of preSeededDrawnCharts) {
    const bucket = bucketForLvl(
      chartLevelOrTier(chart, useGranularLevels),
      buckets,
    );
    if (!bucket) continue;
    seeded.add(bucket.key);
    const pool = pools.get(bucket.key);
    const idxInPool = pool.findIndex(
      (eligibleChart) =>
        eligibleChart.name === chart.name &&
        chart.diffAbbr === eligibleChart.diffAbbr &&
        chart.level === eligibleChart.level,
    );
    if (idxInPool >= 0) {
      pool.splice(idxInPool, 1);
    }
  }

  const drawnCharts = drawFromPools(plan, pools, seeded).map(
    (chart): DrawnChart => ({
      ...chart,
      // Give this random chart a unique id within this drawing
      id: `drawn_chart-${nanoid(5)}`,
      type: CHART_DRAWN,
    }),
  );

  let charts: Drawing["charts"];
  if (configData.sortByLevel) {
    charts = drawnCharts.sort(
      (a, b) =>
        chartLevelOrTier(a, useGranularLevels, false) -
        chartLevelOrTier(b, useGranularLevels, false),
    );
  } else {
    charts = shuffle(drawnCharts);
  }

  if (!startPoint.charts && configData.playerPicks) {
    charts.unshift(...times(configData.playerPicks, newPlaceholder));
  }

  return charts;
}

export function newPlaceholder(): PlayerPickPlaceholder {
  return { id: `pick_placeholder-` + nanoid(5), type: CHART_PLACEHOLDER };
}

import { nanoid } from "nanoid";
import type { ConfigState } from "./config-state";
import type { GameData } from "./models/SongData";
import { getAvailableLevels } from "./game-data-utils";
import { chunkInPieces, times } from "./utils";
import { Fraction } from "./utils/fraction";

/**
 * How the pool of eligible charts gets sliced up before a draw.
 *
 * - `none` — a single bucket covering the configured lvl range
 * - `auto` — the configured lvl range split into evenly sized buckets
 * - `manual` — buckets authored by hand, ignoring the configured lvl range
 *
 * Every mode normalizes down to the same `DrawBucket[]` (see `getDrawBuckets`),
 * so nothing downstream needs to know which one is active.
 */
export type BucketMode = "none" | "auto" | "manual";

/** A hand-authored bucket, as persisted in config */
export interface ManualBucket {
  /** stable identity, so a bucket keeps its weight as the list is edited */
  key: string;
  /** inclusive lower bound, in whatever lvl metric is currently selected */
  low: number;
  /** inclusive upper bound, in whatever lvl metric is currently selected */
  high: number;
  /** relative draw weight. 0 drops the bucket's charts from the pool entirely */
  weight: number;
}

/**
 * One slice of the draw pool: a lvl range plus the rule for how often to draw
 * from it. This is the only shape the draw logic knows about.
 */
export interface DrawBucket extends ManualBucket {
  /** set when the bucket covers exactly one whole lvl. display only */
  wholeLvl?: number;
}

/** the config a bucket layout is derived from */
type BucketConfig = Pick<
  ConfigState,
  | "bucketMode"
  | "probabilityBucketCount"
  | "weights"
  | "manualBuckets"
  | "lowerBound"
  | "upperBound"
  | "useGranularLevels"
>;

/** the config an allocation is derived from */
type AllocationConfig = Pick<ConfigState, "chartCount" | "forceDistribution">;

/** How many charts a single bucket may contribute to one drawing */
export interface BucketAllocation {
  /** draw at least this many from the bucket, pool permitting */
  min: number;
  /** never draw more than this many from the bucket */
  max: number;
}

/**
 * A fully resolved answer to "what are we drawing, and from where". Produced by
 * `planDraw`, consumed by the draw loop, which has no other knowledge of modes,
 * weights, or lvl ranges.
 */
export interface DrawPlan {
  /** how many charts the drawing should end up with */
  total: number;
  /** one entry per unit of weight, used to randomly pick a bucket to draw from */
  deck: Array<string>;
  /** floor/ceiling per bucket key */
  allocations: ReadonlyMap<string, BucketAllocation>;
}

export function makeManualBucket(
  low: number,
  high: number,
  weight = 1,
): ManualBucket {
  return { key: `bucket-${nanoid(6)}`, low, high, weight };
}

/**
 * Normalizes the current config into the list of buckets a draw will use.
 * Buckets with no weight are still returned, so the UI can render them, but
 * they hold no charts as far as the draw is concerned.
 */
export function getDrawBuckets(
  cfg: BucketConfig,
  gameData: GameData | null,
): Array<DrawBucket> {
  switch (cfg.bucketMode) {
    case "manual":
      return cfg.manualBuckets.map((bucket) => ({ ...bucket }));
    case "none":
      return [
        { key: "b0", low: cfg.lowerBound, high: cfg.upperBound, weight: 1 },
      ];
    case "auto": {
      const availableLvls = getAvailableLevels(gameData, cfg.useGranularLevels);
      const ranges = autoBucketRanges(
        cfg,
        availableLvls,
        gameData?.meta.granularTierResolution,
      );
      // weights are stored positionally against the auto layout, so bucket keys
      // are positional too
      return Array.from(ranges, (range, index) => ({
        ...range,
        key: `b${index}`,
        weight: cfg.weights[index] || 0,
      }));
    }
  }
}

/**
 * Finds the bucket a chart of the given lvl will be drawn from. Buckets are
 * matched in list order and the first hit wins, so overlapping manual buckets
 * resolve predictably rather than making a chart drawable twice.
 */
export function bucketForLvl(
  lvl: number,
  buckets: ReadonlyArray<DrawBucket>,
): DrawBucket | undefined {
  return buckets.find((bucket) => lvl >= bucket.low && lvl <= bucket.high);
}

/**
 * Turns a bucket layout into the concrete allocation the draw loop executes.
 *
 * This is the seam where alternate ways of expressing "how much of the draw
 * does this bucket get" belong (e.g. a flat count per bucket instead of a
 * relative weight): only this function needs to learn the new strategy, since
 * the draw loop already works purely in terms of a deck plus min/max.
 */
export function planDraw(
  buckets: ReadonlyArray<DrawBucket>,
  cfg: AllocationConfig,
): DrawPlan {
  const totalWeight = buckets.reduce((sum, bucket) => sum + bucket.weight, 0);
  const deck: Array<string> = [];
  const allocations = new Map<string, BucketAllocation>();

  for (const bucket of buckets) {
    times(bucket.weight, () => deck.push(bucket.key));
    // an unweighted bucket contributes nothing; otherwise a bucket may supply
    // the whole drawing, or none of it
    let min = 0;
    let max = bucket.weight > 0 ? cfg.chartCount : 0;
    if (bucket.weight > 0 && cfg.forceDistribution && totalWeight > 0) {
      // pin each bucket to (very nearly) its exact share of the drawing. e.g.
      // for a 5 card draw the cap rises by 1 at every 100%/5 = 20% threshold,
      // so a bucket weighted at 15% can show up at most once, one at 30% twice
      max = Math.ceil((bucket.weight / totalWeight) * cfg.chartCount);
      min = Math.max(0, max - 1);
    }
    allocations.set(bucket.key, { min, max });
  }

  // a bucket also has to cover whatever every other bucket can't. without this
  // the only bucket in a drawing would report a floor of `chartCount - 1`, even
  // though it has no choice but to supply the whole thing
  const totalMax = Array.from(allocations.values()).reduce(
    (sum, allocation) => sum + allocation.max,
    0,
  );
  for (const allocation of allocations.values()) {
    const forcedShare = cfg.chartCount - (totalMax - allocation.max);
    allocation.min = Math.max(
      allocation.min,
      Math.min(forcedShare, allocation.max),
    );
  }

  return { total: cfg.chartCount, deck, allocations };
}

/**
 * Builds a starting set of manual buckets from whatever the user had configured
 * before switching into manual mode, so the switch doesn't throw away their
 * current setup.
 */
export function seedManualBuckets(
  cfg: BucketConfig,
  gameData: GameData | null,
): Array<ManualBucket> {
  const seeds = getDrawBuckets(
    // `manual` would just hand back the (presumably empty) list we're seeding
    cfg.bucketMode === "manual" ? { ...cfg, bucketMode: "auto" } : cfg,
    gameData,
  ).map((bucket) => makeManualBucket(bucket.low, bucket.high, bucket.weight));

  if (seeds.every((bucket) => !bucket.weight)) {
    // an all-zero layout can't draw anything, so start everyone off even
    return seeds.map((bucket) => ({ ...bucket, weight: 1 }));
  }
  return seeds;
}

/** pairs of manual buckets whose lvl ranges collide */
export function findOverlappingBuckets(
  buckets: ReadonlyArray<ManualBucket>,
): Array<[ManualBucket, ManualBucket]> {
  const overlaps: Array<[ManualBucket, ManualBucket]> = [];
  for (let i = 0; i < buckets.length; i++) {
    for (let j = i + 1; j < buckets.length; j++) {
      if (
        buckets[i].low <= buckets[j].high &&
        buckets[j].low <= buckets[i].high
      ) {
        overlaps.push([buckets[i], buckets[j]]);
      }
    }
  }
  return overlaps;
}

/**
 * Splits the configured lvl range into bucket ranges. Only used by `auto` mode.
 */
function* autoBucketRanges(
  cfg: Pick<
    BucketConfig,
    "probabilityBucketCount" | "upperBound" | "lowerBound" | "useGranularLevels"
  >,
  availableLvls: Array<number>,
  granularResolution: number | undefined,
): Generator<Omit<DrawBucket, "key" | "weight">, void> {
  const { probabilityBucketCount, upperBound, lowerBound } = cfg;

  if (!probabilityBucketCount) {
    // one bucket per whole lvl
    for (let lvl = Math.floor(lowerBound); lvl <= upperBound; lvl++) {
      const bucket = wholeLvlRange(lvl, availableLvls, lowerBound, upperBound);
      if (bucket) {
        yield bucket;
      }
    }
    return;
  }

  const levelsInRange = availableLvls.filter(
    (lvl) => lvl >= lowerBound && lvl <= upperBound,
  );

  if (!granularResolution || !cfg.useGranularLevels) {
    for (const chunk of chunkInPieces(probabilityBucketCount, levelsInRange)) {
      yield { low: chunk[0], high: chunk[chunk.length - 1] };
    }
    return;
  }

  const granularIncrementSize = 1 / granularResolution;
  const absoluteRangeSize = upperBound - lowerBound + granularIncrementSize;
  const bucketWidth = new Fraction(absoluteRangeSize, probabilityBucketCount);
  const lowerBoundF = new Fraction(lowerBound);
  const nudge = new Fraction(1, 1000);
  for (let i = 0; i < probabilityBucketCount; i++) {
    const bucketBottom = bucketWidth.mult(new Fraction(i)).add(lowerBoundF);
    const bucketTop = bucketBottom.add(bucketWidth);
    // TODO: slice off that array of available levels here to avoid overlap/reuse due to rounding errors
    yield {
      low: clampToNearest(
        granularIncrementSize,
        bucketBottom.valueOf(),
        Math.ceil,
      ),
      high: clampToNearest(
        granularIncrementSize,
        bucketTop.sub(nudge).valueOf(),
        Math.floor,
      ),
    };
  }
}

/**
 * The range covering a single whole lvl, clipped to the configured bounds. In
 * granular mode a whole lvl spans every tier that floors to it, so this has to
 * consult the available lvls rather than assume a width.
 */
function wholeLvlRange(
  lvl: number,
  availableLvls: Array<number>,
  lowerBound: number,
  upperBound: number,
): Omit<DrawBucket, "key" | "weight"> | undefined {
  let high = lvl;
  for (const available of availableLvls) {
    if (Math.floor(available) === lvl && available > high) {
      high = available;
    }
  }
  const low = Math.max(lvl, lowerBound);
  high = Math.min(high, upperBound);
  if (low > high) {
    return undefined;
  }
  return { low, high, wholeLvl: lvl };
}

function clampToNearest(incr: number, n: number, clamp: (n: number) => number) {
  const multor = Math.round(1 / incr);
  let ret = clamp(n * multor) / multor;
  if (Number.isInteger(n) && clamp === Math.floor) {
    ret -= incr;
  }
  return ret;
}

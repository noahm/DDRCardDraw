import { getAvailableLevels } from "./game-data-utils";
import type { EligibleChart } from "./models/Drawing";
import type { GameData } from "./models/SongData";
import { zeroPad } from "./utils";

/**
 * A lvl as players of the game refer to it, and the span of internal lvl values
 * it covers.
 *
 * Most games map one to one: lvl 15 is the single value 15. Games with
 * plus-suffixed lvls (maimai) store chart constants instead, so the lvl players
 * call "13+" covers a run of them — 13.6 through 13.9. Buckets are matched on
 * raw numbers, so a band is how we let users think and type in the game's own
 * terms without the draw logic knowing anything about it.
 */
export interface LvlBand {
  /** what to show the user, eg "13+" */
  label: string;
  /** lowest internal lvl value in this band */
  low: number;
  /** highest internal lvl value in this band */
  high: number;
}

const bandCache = new WeakMap<GameData, Map<string, Array<LvlBand>>>();

/**
 * Every lvl this game offers, in ascending order, as players refer to them.
 * This is the list users pick range bounds from, so on games that draw by tier
 * it enumerates tiers rather than chart lvls.
 */
export function getLvlBands(
  gameData: GameData | null,
  useGranular = false,
): Array<LvlBand> {
  return buildBands(gameData, useGranular, false);
}

/**
 * How to render an individual chart's lvl. Distinct from `getLvlBands` because
 * a chart on a tier-drawing game still has its own difficulty lvl, which is
 * what belongs on its card — the tier is a grouping, not a lvl.
 */
export function getChartLvlBands(
  gameData: GameData | null,
  useGranular = false,
): Array<LvlBand> {
  return buildBands(gameData, useGranular, true);
}

function buildBands(
  gameData: GameData | null,
  useGranular: boolean,
  ignoreTiers: boolean,
): Array<LvlBand> {
  if (!gameData) {
    return [];
  }
  let cachedForGame = bandCache.get(gameData);
  if (!cachedForGame) {
    cachedForGame = new Map();
    bandCache.set(gameData, cachedForGame);
  }
  const cacheKey = `${useGranular}:${ignoreTiers}`;
  const cached = cachedForGame.get(cacheKey);
  if (cached) {
    return cached;
  }

  const availableLvls = getAvailableLevels(gameData, useGranular, ignoreTiers);
  const threshold = gameData.meta.lvlPlusThreshold;
  let bands: Array<LvlBand>;

  if (gameData.meta.usesDrawGroups && !ignoreTiers) {
    // these games number tiers rather than lvls, and label them accordingly
    bands = availableLvls.map((lvl) => ({
      label: `T${zeroPad(lvl, 2)}`,
      low: lvl,
      high: lvl,
    }));
  } else if (!threshold) {
    bands = availableLvls.map((lvl) => ({
      label: lvl.toString(),
      low: lvl,
      high: lvl,
    }));
  } else {
    // collapse the raw values into one band per label, preserving ascending
    // order since `availableLvls` is already sorted
    const byLabel = new Map<string, LvlBand>();
    for (const lvl of availableLvls) {
      const label = plusLabel(lvl, threshold);
      const band = byLabel.get(label);
      if (band) {
        band.high = lvl;
      } else {
        byLabel.set(label, { label, low: lvl, high: lvl });
      }
    }
    bands = Array.from(byLabel.values());
  }

  cachedForGame.set(cacheKey, bands);
  return bands;
}

function plusLabel(lvl: number, threshold: number) {
  const whole = Math.floor(lvl);
  return lvl - whole >= threshold ? `${whole}+` : whole.toString();
}

/** the band a raw lvl value falls in, if any */
export function bandForLvl(
  bands: ReadonlyArray<LvlBand>,
  lvl: number,
): LvlBand | undefined {
  return bands.find((band) => lvl >= band.low && lvl <= band.high);
}

/** renders a raw lvl value the way the game refers to it */
export function formatLvl(bands: ReadonlyArray<LvlBand>, lvl: number): string {
  const band = bandForLvl(bands, lvl);
  if (band) {
    return band.label;
  }
  // a value between (or outside) known bands, eg a bound left over from an
  // older data file. show it literally rather than pretending it's a real lvl
  return lvl.toString();
}

/**
 * Resolves typed text to one of the game's lvls. Accepts the plus character
 * with or without surrounding space, and tolerates a raw internal value so
 * anything `formatLvl` can produce round-trips back.
 */
export function parseLvl(
  bands: ReadonlyArray<LvlBand>,
  text: string,
): LvlBand | undefined {
  const normalized = text.trim().replace(/\s+/g, "").replace("＋", "+");
  if (!normalized) {
    return undefined;
  }
  const byLabel = bands.find((band) => band.label === normalized);
  if (byLabel) {
    return byLabel;
  }
  const asNumber = parseFloat(normalized);
  if (isNaN(asNumber)) {
    return undefined;
  }
  return bandForLvl(bands, asNumber) || nearestBand(bands, asNumber);
}

/** the band closest to a raw value, for pulling stray bounds back onto a lvl */
export function nearestBand(
  bands: ReadonlyArray<LvlBand>,
  lvl: number,
): LvlBand | undefined {
  let closest: LvlBand | undefined;
  let closestDistance = Infinity;
  for (const band of bands) {
    // distance to the band's span, zero when inside it
    const distance =
      lvl < band.low ? band.low - lvl : lvl > band.high ? lvl - band.high : 0;
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = band;
    }
  }
  return closest;
}

/** steps `offset` lvls away from whichever band `lvl` sits in */
export function stepLvl(
  bands: ReadonlyArray<LvlBand>,
  lvl: number,
  offset: number,
): LvlBand | undefined {
  const current = bandForLvl(bands, lvl) || nearestBand(bands, lvl);
  if (!current) {
    return undefined;
  }
  return bands[bands.indexOf(current) + offset];
}

/**
 * Renders a chart's lvl for display on a card. Pass bands from
 * `getChartLvlBands`, not `getLvlBands`.
 */
export function formatLevel(
  chart: EligibleChart,
  useGranular: boolean,
  bands: ReadonlyArray<LvlBand>,
) {
  if (useGranular) {
    return (chart.granularLevel || chart.level).toFixed(2);
  }
  // games whose lvls aren't plain numbers (maimai's "13+") need the band list
  // to render them the way players refer to them
  return bands.length ? formatLvl(bands, chart.level) : chart.level;
}

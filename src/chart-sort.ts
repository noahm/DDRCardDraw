import { chartLevelOrTier } from "./utils/chart-level";
import {
  CHART_PLACEHOLDER,
  DrawnChart,
  PlayerPickPlaceholder,
} from "./models/Drawing";
import { shuffle } from "./utils/shuffle";

/**
 * How a finished draw arranges its cards.
 *
 * - `drawn` leaves them in the order the draw produced them
 * - `level` orders them easiest to hardest
 * - `shuffle` puts them in a random order
 *
 * These values are stored in configs and in saved rooms, so they're spelled
 * out rather than derived from anything that could be renamed out from under
 * them.
 */
export const CHART_SORTS = ["drawn", "level", "shuffle"] as const;

export type ChartSort = (typeof CHART_SORTS)[number];

/**
 * What a config sorts by when it doesn't say. Shuffling is what every draw did
 * before there was a choice, so it stays the default.
 */
export const DEFAULT_CHART_SORT: ChartSort = "shuffle";

export function isChartSort(value: unknown): value is ChartSort {
  return CHART_SORTS.includes(value as ChartSort);
}

/** the sort a config asks for, falling back to the default if it names none */
export function chartSortOf(config?: { chartSort?: ChartSort }): ChartSort {
  const sort = config?.chartSort;
  return isChartSort(sort) ? sort : DEFAULT_CHART_SORT;
}

type SortableChart = DrawnChart | PlayerPickPlaceholder;

/**
 * Arrange a set of cards the way a config asks for.
 *
 * Free-pick placeholders always lead, whatever the sort: they hold no chart,
 * so there's nothing to order them by, and a draw has always shown them first.
 * That also keeps a merge tidy, since each sub-draw brings its own
 * placeholders along from wherever they sat within it.
 *
 * Returns a new array, leaving the one passed in alone.
 */
export function sortCharts(
  charts: ReadonlyArray<SortableChart>,
  sort: ChartSort,
  useGranularLevels: boolean,
): Array<SortableChart> {
  const placeholders: Array<SortableChart> = [];
  const drawn: Array<DrawnChart> = [];
  for (const chart of charts) {
    if (chart.type === CHART_PLACEHOLDER) {
      placeholders.push(chart);
    } else {
      drawn.push(chart);
    }
  }
  switch (sort) {
    case "level":
      drawn.sort(
        (a, b) =>
          chartLevelOrTier(a, useGranularLevels, false) -
          chartLevelOrTier(b, useGranularLevels, false),
      );
      break;
    case "shuffle":
      return placeholders.concat(shuffle(drawn));
    case "drawn":
      break;
  }
  return placeholders.concat(drawn);
}

/**
 * Bring a config saved before the card order was a choice up to date.
 *
 * `sortByLevel` was a checkbox: checked meant the level sort, unchecked meant
 * a shuffle, and both are orders a config can still ask for by name. Mutates
 * the config in place and drops the old key, so a stale answer can't outlive
 * the setting that replaced it.
 */
export function adoptLegacyChartSort(config: object) {
  const loose = config as Record<string, unknown>;
  const legacySortByLevel = loose.sortByLevel;
  delete loose.sortByLevel;
  if (isChartSort(loose.chartSort)) return;
  if (typeof legacySortByLevel === "boolean") {
    loose.chartSort = legacySortByLevel ? "level" : "shuffle";
  } else {
    loose.chartSort = DEFAULT_CHART_SORT;
  }
}

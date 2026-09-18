import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { primaryReuseKey } from "../chart-id";
import { formatLevel } from "../game-data-utils";
import { EligibleChart } from "../models/Drawing";
import { configSlice } from "../state/config.slice";
import { drawingsSlice, selectSpentCharts } from "../state/drawings.slice";
import { useAppState } from "../state/store";
import { getJacketUrl } from "../utils/jackets";
import "./drawn-charts.css";

/**
 * An OBS source showing every chart this event has already spent, so a stream
 * can show viewers what has come out of the pool. Two layouts, because a
 * stream layout dictates which one fits: `grid` (the default) gives each chart
 * a mini jacket, `list` drops the art for text rows grouped by level and fits
 * several times as many charts in the same space.
 *
 * The pool of a long event runs to hundreds of charts, most of them levels the
 * bracket has already climbed past, so the list is filtered to a level range.
 * By default that range comes from the config behind the most recent draw,
 * which follows the event on its own as rounds get harder. The room's config
 * *selection* can't drive it -- that lives in one browser's localStorage, and
 * this source runs in its own browser inside OBS -- so where the newest draw
 * isn't the right answer, the URL says so instead:
 *
 * - `?config=<configId>` pins the range to a specific config
 * - `?min=15&max=17` states a range outright, in in-game levels
 * - `?all` turns filtering off and shows the whole history
 */
export function DrawnCharts() {
  const params = useParams<"layout">();
  const range = useLevelRange();
  const spentCharts = useAppState(selectSpentCharts);
  const charts = useMemo(
    () => chartsToShow(spentCharts, range),
    [spentCharts, range],
  );
  const useGranular = range?.useGranularLevels || false;

  return (
    <div className="drawn-charts">
      <div className="drawn-charts-header">
        <span className="drawn-charts-count">
          {charts.length} chart{charts.length === 1 ? "" : "s"} drawn
        </span>
        {range && (
          <span className="drawn-charts-range">{describeRange(range)}</span>
        )}
      </div>
      {params.layout === "list" ? (
        <LevelGroupedList charts={charts} useGranular={useGranular} />
      ) : (
        <ChartGrid charts={charts} useGranular={useGranular} />
      )}
    </div>
  );
}

interface LayoutProps {
  charts: EligibleChart[];
  useGranular: boolean;
}

function ChartGrid({ charts, useGranular }: LayoutProps) {
  return (
    <div className="drawn-charts-grid">
      {charts.map((chart) => (
        <div
          key={primaryReuseKey(chart)}
          className="drawn-chart"
          style={{ borderLeftColor: chart.diffColor }}
          title={chart.name}
        >
          {chart.jacket && (
            <img
              className="drawn-chart-jacket"
              src={getJacketUrl(chart.jacket)}
              alt=""
              loading="lazy"
            />
          )}
          <div className="drawn-chart-text">
            <div className="drawn-chart-name">{chart.name}</div>
            <div
              className="drawn-chart-diff"
              style={{ color: chart.diffColor }}
            >
              {chart.diffAbbr} {formatLevel(chart, useGranular)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LevelGroupedList({ charts, useGranular }: LayoutProps) {
  const groups = useMemo(() => groupByLevel(charts), [charts]);
  return (
    <div className="drawn-charts-list">
      {groups.map((group) => (
        <div key={group.level} className="drawn-charts-level">
          <div className="drawn-charts-level-label">Lv {group.level}</div>
          {group.charts.map((chart) => (
            <div key={primaryReuseKey(chart)} className="drawn-chart-row">
              <span
                className="drawn-chart-diff"
                style={{ color: chart.diffColor }}
              >
                {chart.diffAbbr}
              </span>
              <span className="drawn-chart-name" title={chart.name}>
                {chart.name}
              </span>
              {useGranular && (
                <span className="drawn-chart-tier">
                  {formatLevel(chart, true)}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The level bounds spent charts are narrowed to, or null to show them all. */
interface LevelRange {
  lowerBound: number;
  upperBound: number;
  useGranularLevels: boolean;
}

function useLevelRange(): LevelRange | null {
  const [searchParams] = useSearchParams();
  const showAll = searchParams.has("all");
  const min = numericParam(searchParams.get("min"));
  const max = numericParam(searchParams.get("max"));
  const pinnedConfigId = searchParams.get("config");
  const newestDrawConfigId = useAppState(
    drawingsSlice.selectors.newestDrawConfigId,
  );
  const configId = pinnedConfigId || newestDrawConfigId;
  const config = useAppState((state) =>
    configId ? configSlice.selectors.selectById(state, configId) : undefined,
  );

  return useMemo(() => {
    if (showAll) {
      return null;
    }
    if (min !== undefined || max !== undefined) {
      // a range given in the URL is stated in in-game levels; reading it as
      // granular tiers would quietly mean something other than what was typed.
      // An open end is allowed, so `?max=17` reads as "17 and below".
      return {
        lowerBound: min ?? -Infinity,
        upperBound: max ?? Infinity,
        useGranularLevels: false,
      };
    }
    if (!config) {
      // nothing drawn yet, or a pinned config that no longer exists
      return null;
    }
    return {
      lowerBound: config.lowerBound,
      upperBound: config.upperBound,
      useGranularLevels: config.useGranularLevels,
    };
  }, [showAll, min, max, config]);
}

function numericParam(raw: string | null): number | undefined {
  if (raw === null) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function describeRange(range: LevelRange): string {
  const { lowerBound, upperBound } = range;
  if (!Number.isFinite(lowerBound)) {
    return `Lv ${upperBound} and below`;
  }
  if (!Number.isFinite(upperBound)) {
    return `Lv ${lowerBound} and up`;
  }
  if (lowerBound === upperBound) {
    return `Lv ${lowerBound}`;
  }
  return `Lv ${lowerBound}–${upperBound}`;
}

/**
 * The chart a `useGranularLevels` config sorts and filters by. A chart with no
 * granular tier keeps its in-game rating rather than dropping out of the view:
 * it was still drawn, and this is a record of what was drawn.
 */
function levelMetric(chart: EligibleChart, useGranular: boolean): number {
  return useGranular ? (chart.granularLevel ?? chart.level) : chart.level;
}

/**
 * Sorted by level rather than left in draw order, because the question this
 * answers is "what is gone from the pool", not "what happened recently" -- and
 * the list layout groups by level regardless. Difficulties sort by their
 * abbreviation, which is arbitrary but keeps a level's ESP charts together;
 * a chart doesn't carry its difficulty's position in the game's own order.
 */
function chartsToShow(
  spentCharts: EligibleChart[],
  range: LevelRange | null,
): EligibleChart[] {
  const useGranular = range?.useGranularLevels || false;
  const visible = range
    ? spentCharts.filter((chart) => {
        const level = levelMetric(chart, useGranular);
        return level >= range.lowerBound && level <= range.upperBound;
      })
    : spentCharts.slice();
  return visible.sort(
    (a, b) =>
      levelMetric(a, useGranular) - levelMetric(b, useGranular) ||
      a.diffAbbr.localeCompare(b.diffAbbr) ||
      a.name.localeCompare(b.name),
  );
}

/** consecutive runs of one in-game level, given charts already sorted by level */
function groupByLevel(charts: EligibleChart[]) {
  const groups: Array<{ level: number; charts: EligibleChart[] }> = [];
  for (const chart of charts) {
    const openGroup = groups[groups.length - 1];
    if (openGroup && openGroup.level === chart.level) {
      openGroup.charts.push(chart);
    } else {
      groups.push({ level: chart.level, charts: [chart] });
    }
  }
  return groups;
}

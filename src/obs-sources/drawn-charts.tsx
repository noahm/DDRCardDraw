import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { eligibleCharts } from "../card-draw";
import {
  chartIsUsed,
  diffClassOfChart,
  primaryReuseKey,
  styleOfChart,
} from "../chart-id";
import { formatLevel } from "../game-data-utils";
import { EligibleChart } from "../models/Drawing";
import { configSlice, type ConfigState } from "../state/config.slice";
import {
  drawingsSlice,
  selectChartUsage,
  selectSpentCharts,
} from "../state/drawings.slice";
import { useGameDataForKey } from "../state/game-data.atoms";
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
 *
 * Separately from the level range, two URL-only options with nothing on the
 * dashboard offering them narrow by the game data's own keys, each taking a
 * comma separated list and matching case-insensitively:
 *
 * - `?style=team` keeps only charts of those play styles
 * - `?diff=D,DP` keeps only charts of those difficulty classes, which is the
 *   only way to split Pump's singles from its doubles (both are `solo` style)
 *
 * `?all` lifts neither. Charts too old to know their style or class drop out
 * while the matching option is set.
 */
export function DrawnCharts() {
  return <ChartPoolSource mode="drawn" />;
}

/**
 * The inverse of {@link DrawnCharts}: every chart the config's pool still
 * holds, i.e. its eligible charts less everything the event has spent. The
 * pool is the config's (by default the newest draw's, or `?config=`), and all
 * of the same layouts and URL options apply on top of it. `?all` only lifts
 * the level range, so it shows the config's whole remaining pool rather than
 * every chart in the game. Spent charts are left out whether or not the event
 * is enforcing chart reuse, since "what hasn't come out yet" is the question.
 */
export function RemainingCharts() {
  return <ChartPoolSource mode="remaining" />;
}

function ChartPoolSource({ mode }: { mode: "drawn" | "remaining" }) {
  const params = useParams<"layout">();
  const config = useSourceConfig();
  const range = useLevelRange(config);
  const styles = useListParam("style");
  const diffs = useListParam("diff");
  const spentCharts = useAppState(selectSpentCharts);
  const remainingCharts = useRemainingCharts(
    mode === "remaining" ? config : undefined,
  );
  const pool = mode === "remaining" ? remainingCharts : spentCharts;
  const charts = useMemo(
    () => chartsToShow(pool, range, styles, diffs),
    [pool, range, styles, diffs],
  );
  const useGranular = range?.useGranularLevels || false;

  return (
    <div className="drawn-charts">
      <div className="drawn-charts-header">
        <span className="drawn-charts-count">
          {charts.length} chart{charts.length === 1 ? "" : "s"}{" "}
          {mode === "remaining" ? "remaining" : "drawn"}
        </span>
        {(range || styles || diffs) && (
          <span className="drawn-charts-range">
            {[
              styles?.join(", "),
              diffs?.join(", "),
              range && describeRange(range),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
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

/** The level bounds a source's charts are narrowed to, or null to show them all. */
interface LevelRange {
  lowerBound: number;
  upperBound: number;
  useGranularLevels: boolean;
}

/**
 * The config this source follows: the one `?config=` pins, or else the one
 * behind the most recent draw. Undefined before anything is drawn, or when a
 * pinned config no longer exists.
 */
function useSourceConfig(): ConfigState | undefined {
  const [searchParams] = useSearchParams();
  const pinnedConfigId = searchParams.get("config");
  const newestDrawConfigId = useAppState(
    drawingsSlice.selectors.newestDrawConfigId,
  );
  const configId = pinnedConfigId || newestDrawConfigId;
  return useAppState((state) =>
    configId ? configSlice.selectors.selectById(state, configId) : undefined,
  );
}

/**
 * The charts `config` could still draw: its eligible pool less every chart the
 * event has spent. Empty until the config's game data has loaded, and when
 * there's no config to take a pool from.
 */
function useRemainingCharts(config: ConfigState | undefined): EligibleChart[] {
  const gameData = useGameDataForKey(config?.gameKey || "");
  const usedKeys = useAppState((state) => selectChartUsage(state).keys);
  return useMemo(() => {
    if (!config || !gameData) {
      return [];
    }
    // a chart grafted onto a song more than once is still one chart
    const byKey = new Map<string, EligibleChart>();
    for (const chart of eligibleCharts(config, gameData)) {
      const key = primaryReuseKey(chart);
      if (!byKey.has(key) && !chartIsUsed(chart, usedKeys)) {
        byKey.set(key, chart);
      }
    }
    return Array.from(byKey.values());
  }, [config, gameData, usedKeys]);
}

function useLevelRange(config: ConfigState | undefined): LevelRange | null {
  const [searchParams] = useSearchParams();
  const showAll = searchParams.has("all");
  const min = numericParam(searchParams.get("min"));
  const max = numericParam(searchParams.get("max"));

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

/**
 * The lowercased values of a comma separated search param, e.g. `?style=` or
 * `?diff=`, or null when it names nothing and shouldn't filter at all.
 */
function useListParam(name: string): string[] | null {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get(name);
  return useMemo(() => {
    const values = (raw || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    return values.length ? values : null;
  }, [raw]);
}

/** true if `value` is known and among `allowed` (already lowercased) */
function matchesList(value: string | undefined, allowed: string[]) {
  return !!value && allowed.includes(value.toLowerCase());
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
 * answers is "what is gone from (or left in) the pool", not "what happened
 * recently" -- and
 * the list layout groups by level regardless. Difficulties sort by their
 * abbreviation, which is arbitrary but keeps a level's ESP charts together;
 * a chart doesn't carry its difficulty's position in the game's own order.
 */
function chartsToShow(
  charts: EligibleChart[],
  range: LevelRange | null,
  styles: string[] | null,
  diffs: string[] | null,
): EligibleChart[] {
  const useGranular = range?.useGranularLevels || false;
  const visible = charts.filter((chart) => {
    if (styles && !matchesList(styleOfChart(chart), styles)) {
      return false;
    }
    if (diffs && !matchesList(diffClassOfChart(chart), diffs)) {
      return false;
    }
    if (range) {
      const level = levelMetric(chart, useGranular);
      return level >= range.lowerBound && level <= range.upperBound;
    }
    return true;
  });
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

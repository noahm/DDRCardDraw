import { BarChart, type BarChartSeries, ChartTooltip } from "@mantine/charts";
import { useMemo } from "react";
import { EligibleChart } from "../models/Drawing";
import { CountingSet } from "../utils/counting-set";
import {
  chartLevelOrTier,
  getAvailableLevels,
  useGetDiffClass,
  useGetMetaString,
} from "../game-data-utils";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { useConfigState, useGameData } from "../state/hooks";

interface Props {
  charts: EligibleChart[];
}

/**
 * One bar of the histogram: a single level, the count of eligible charts of
 * each difficulty class at that level (keyed by difficulty key), plus a total.
 */
type LevelRow = Record<string, number> & {
  level: number;
  total: number;
};

function formatLevel(level: number) {
  return Number.isInteger(level) ? level.toString() : level.toFixed(1);
}

export function DiffHistogram({ charts }: Props) {
  const isNarrow = useIsNarrow();
  const gameData = useGameData();
  const allDiffs = gameData?.meta.difficulties;
  const useGranularLevels = useConfigState((s) => s.useGranularLevels);
  const availableLevels = getAvailableLevels(gameData, useGranularLevels, true);
  const getDiffClass = useGetDiffClass();
  const getMetaString = useGetMetaString();

  const [data, series] = useMemo(() => {
    const countByClassAndLvl: Record<string, CountingSet<number>> = {};
    const levelsInUse = new CountingSet<number>();
    for (const chart of charts) {
      if (!countByClassAndLvl[chart.diffAbbr]) {
        countByClassAndLvl[chart.diffAbbr] = new CountingSet();
      }
      const level = chartLevelOrTier(chart, useGranularLevels, false);
      countByClassAndLvl[chart.diffAbbr].add(level);
      levelsInUse.add(level);
    }
    // reversed so that the hardest difficulty stacks on the bottom,
    // matching the order difficulties are drawn in everywhere else
    const difficulties = (allDiffs || [])
      .filter((d) => !!countByClassAndLvl[getDiffClass(d.key)])
      .reverse();

    // span every level between the lowest and highest in use, so that levels
    // with no eligible charts still take up space on the x axis
    const orderedLevels = Array.from(levelsInUse.values()).sort(
      (a, b) => a - b,
    );
    const firstIdx = availableLevels.indexOf(orderedLevels[0]);
    const lastIdx = availableLevels.indexOf(
      orderedLevels[orderedLevels.length - 1],
    );
    const levels =
      firstIdx < 0 || lastIdx < 0
        ? orderedLevels
        : availableLevels.slice(firstIdx, lastIdx + 1);

    const data = levels.map((level) => {
      const row: LevelRow = { level, total: 0 };
      for (const diff of difficulties) {
        const count =
          countByClassAndLvl[getDiffClass(diff.key)].get(level) || 0;
        row[diff.key] = count;
        row.total += count;
      }
      return row;
    });

    const series: BarChartSeries[] = difficulties.map((diff) => ({
      name: diff.key,
      label: getMetaString(diff.key),
      color: diff.color,
    }));

    return [data, series];
  }, [
    allDiffs,
    charts,
    useGranularLevels,
    getDiffClass,
    getMetaString,
    availableLevels,
  ]);

  if (!data.length) {
    return null;
  }

  // recharts stacks bars in the order they're declared, so the last series
  // is the one on top of the stack. Only it gets a label, showing the total.
  const topSeries = series[series.length - 1].name;
  // totals over every bar turn to mush once the bars get thin
  const withTotals = data.length <= (isNarrow ? 10 : 24);

  return (
    <BarChart
      h={isNarrow ? 200 : 300}
      data={data}
      dataKey="level"
      series={series}
      type="stacked"
      maxBarWidth={64}
      xAxisLabel="Chart Level"
      // leave headroom above the tallest stack for its total label
      barChartProps={{ margin: { top: 16, bottom: 30 } }}
      xAxisProps={{
        interval: "preserveStartEnd",
        minTickGap: 8,
        tickFormatter: formatLevel,
      }}
      yAxisProps={{ allowDecimals: false }}
      withBarValueLabel={withTotals}
      valueLabelProps={(item: BarChartSeries) =>
        item.name === topSeries
          ? {
              dataKey: "total",
              position: "top",
              offset: 6,
              formatter: (total) => (total ? String(total) : ""),
            }
          : { content: () => null }
      }
      tooltipProps={{
        content: ({ label, payload }) => {
          const stack = (payload || []).filter((item) => item.value).reverse();
          if (!stack.length) {
            return null;
          }
          const total = stack.reduce(
            (sum, item) => sum + (item.value as number),
            0,
          );
          return (
            <ChartTooltip
              label={`Level ${formatLevel(label as number)} — ${total} chart${
                total === 1 ? "" : "s"
              }`}
              payload={stack}
              series={series}
            />
          );
        },
      }}
    />
  );
}

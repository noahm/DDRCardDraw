import { EligibleChart } from "../models/Drawing";
import {
  VictoryChart,
  VictoryBar,
  VictoryStack,
  VictoryAxis,
  VictoryTooltip,
  VictoryLabel,
} from "victory";
import { useMemo } from "react";
import { CountingSet } from "../utils/counting-set";
import {
  chartLevelOrTier,
  getAvailableLevels,
  useGetDiffClass,
  useGetMetaString,
} from "../game-data-utils";
import { Theme, useTheme } from "../theme-toggle";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { useConfigState, useGameData } from "../state/hooks";

interface Props {
  charts: EligibleChart[];
}

export function DiffHistogram({ charts }: Props) {
  const fgColor = useTheme() === Theme.Dark ? "white" : undefined;
  const isNarrow = useIsNarrow();
  const gameData = useGameData();
  const allDiffs = gameData?.meta.difficulties;
  const useGranularLevels = useConfigState((s) => s.useGranularLevels);
  const availableLevels = getAvailableLevels(gameData, useGranularLevels, true);
  const getDiffClass = useGetDiffClass();
  const getMetaString = useGetMetaString();
  function formatLabel(idx: number) {
    const n = availableLevels[idx];
    if (!n) return "";
    return (n * 10) % 2
      ? ""
      : Number.isInteger(n)
        ? n.toString()
        : n.toFixed(1);
  }
  const [dataPerDiff, colors, xAxisLabels, totals] = useMemo(() => {
    const countByClassAndLvl: Record<string, CountingSet<number>> = {};
    let maxBar = 0;
    const allLevels = new CountingSet<number>();
    for (const chart of charts) {
      if (!countByClassAndLvl[chart.diffAbbr]) {
        countByClassAndLvl[chart.diffAbbr] = new CountingSet();
      }
      const level = chartLevelOrTier(chart, useGranularLevels, false);
      countByClassAndLvl[chart.diffAbbr].add(level);
      maxBar = Math.max(maxBar, allLevels.add(level));
    }
    const orderedLevels = Array.from(allLevels.values()).sort((a, b) => a - b);
    const difficulties = (allDiffs || [])
      .filter((d) => !!countByClassAndLvl[getDiffClass(d.key)])
      .reverse();
    const dataPerDiff = difficulties.map((diff) => ({
      color: diff.color,
      key: diff.key,
      label: getMetaString(diff.key),
      data: orderedLevels.map((lvl) => ({
        xPlacement: availableLevels.indexOf(lvl),
        level: lvl,
        count: countByClassAndLvl[getDiffClass(diff.key)].get(lvl) || 0,
      })),
    }));
    return [
      dataPerDiff,
      difficulties.map((d) => d.color),
      orderedLevels.map((d) => availableLevels.indexOf(d)),
      Array.from(allLevels.valuesWithCount())
        .sort((a, b) => a[0] - b[0])
        .map(([, count]) => count),
    ];
  }, [
    allDiffs,
    charts,
    useGranularLevels,
    getDiffClass,
    getMetaString,
    availableLevels,
  ]);

  return (
    <VictoryChart
      domainPadding={{ x: totals.length === 2 ? 250 : 50 }}
      style={{
        parent: { height: isNarrow ? "200px" : "300px", touchAction: "auto" },
      }}
      width={isNarrow ? 600 : 800}
    >
      <VictoryStack
        colorScale={colors}
        labels={totals}
        labelComponent={<VictoryLabel />}
      >
        {dataPerDiff.map((dataSet) => (
          <VictoryBar
            key={dataSet.key}
            data={dataSet.data}
            labels={dataSet.data.map(
              (d) => `${d.count} ${dataSet.label} charts`,
            )}
            style={{
              labels: { fill: fgColor },
            }}
            x="xPlacement"
            y="count"
            labelComponent={<VictoryTooltip />}
          />
        ))}
      </VictoryStack>
      <VictoryAxis
        tickValues={xAxisLabels}
        tickFormat={formatLabel}
        label="Chart Level"
        style={{
          axis: { stroke: fgColor },
          tickLabels: { fill: fgColor },
          axisLabel: { fill: fgColor },
        }}
      />
    </VictoryChart>
  );
}

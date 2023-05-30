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
import { CountingSet } from "../utils";
import { useDrawState } from "../draw-state";
import { useIntl } from "../hooks/useIntl";
import { getDiffClass, getMetaString } from "../game-data-utils";
import { Theme, useTheme } from "../theme-toggle";
import { useIsNarrow } from "../hooks/useMediaQuery";

interface Props {
  charts: EligibleChart[];
}

export function DiffHistogram({ charts }: Props) {
  const { t } = useIntl();
  const fgColor = useTheme() === Theme.Dark ? "white" : undefined;
  const isNarrow = useIsNarrow();
  const allDiffs = useDrawState((s) => s.gameData?.meta.difficulties) || [];
  const [dataPerDiff, colors, xAxisLabels, totals] = useMemo(() => {
    const countByClassAndLvl: Record<string, CountingSet<number>> = {};
    let maxBar = 0;
    const allLevels = new CountingSet<number>();
    for (const chart of charts) {
      if (!countByClassAndLvl[chart.diffAbbr]) {
        countByClassAndLvl[chart.diffAbbr] = new CountingSet();
      }
      countByClassAndLvl[chart.diffAbbr].add(chart.level);
      maxBar = Math.max(maxBar, allLevels.add(chart.level));
    }
    const orderedLevels = Array.from(allLevels.values()).sort((a, b) => a - b);
    const difficulties = allDiffs
      .filter((d) => !!countByClassAndLvl[getDiffClass(t, d.key)])
      .reverse();
    const dataPerDiff = difficulties.map((diff) => ({
      color: diff.color,
      key: diff.key,
      label: getMetaString(t, diff.key),
      data: orderedLevels.map((lvl) => ({
        level: lvl,
        count: countByClassAndLvl[getDiffClass(t, diff.key)].get(lvl) || 0,
      })),
    }));
    return [
      dataPerDiff,
      difficulties.map((d) => d.color),
      Array.from(allLevels.values()).sort((a, b) => a - b),
      Array.from(allLevels.valuesWithCount())
        .sort((a, b) => a[0] - b[0])
        .map(([_, count]) => count),
    ];
  }, [charts]);

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
              (d) => `${d.count} ${dataSet.label} charts`
            )}
            style={{
              labels: { fill: fgColor },
            }}
            x="level"
            y="count"
            labelComponent={<VictoryTooltip />}
          />
        ))}
      </VictoryStack>
      <VictoryAxis
        tickValues={xAxisLabels}
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

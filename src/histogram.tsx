import { DrawnChart } from "./models/Drawing";
import { Chart } from "react-google-charts";
import { useMemo } from "react";
import { CountingSet } from "./utils";
import { useDrawState } from "./draw-state";
import { useIntl } from "./hooks/useIntl";
import { getMetaString } from "./game-data-utils";

interface Props {
  charts: DrawnChart[];
}

export function DiffHistogram({ charts }: Props) {
  const { t } = useIntl();
  const allDiffs = useDrawState((s) => s.gameData?.meta.difficulties) || [];
  const [data, colors, maxCount] = useMemo(() => {
    const countByClassAndLvl: Record<string, CountingSet<number>> = {};
    let maxBar = 0;
    const allLevels = new CountingSet<number>();
    for (const chart of charts) {
      if (!countByClassAndLvl[chart.difficultyClass]) {
        countByClassAndLvl[chart.difficultyClass] = new CountingSet();
      }
      countByClassAndLvl[chart.difficultyClass].add(chart.level);
      maxBar = Math.max(maxBar, allLevels.add(chart.level));
    }
    const orderedLevels = Array.from(allLevels.values()).sort((a, b) => a - b);
    const difficulties = allDiffs
      .filter((d) => !!countByClassAndLvl[d.key])
      .reverse();
    const data = [
      [
        "Level",
        ...difficulties.map((d) => getMetaString(t, d.key) + " Charts"),
      ],
      ...orderedLevels.map((lvl) => [
        `Lv ${lvl}`,
        ...difficulties.map(
          (diff) => countByClassAndLvl[diff.key].get(lvl) || null
        ),
      ]),
    ];
    return [data, difficulties.map((d) => d.color), maxBar];
  }, [charts]);

  return (
    <Chart
      chartType="ColumnChart"
      data={data}
      options={{
        colors,
        isStacked: true,
        legend: "none",
        height: 300,
        vAxis: {
          viewWindow: { max: maxCount },
          title: "Number of Charts",
        },
      }}
    />
  );
}

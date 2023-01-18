import { DrawnChart } from "./models/Drawing";
import {
  VictoryChart,
  VictoryBar,
  VictoryStack,
  VictoryAxis,
  VictoryTooltip,
  VictoryLabel,
} from "victory";
import { useMemo } from "react";
import { CountingSet } from "./utils";
import { useDrawState } from "./draw-state";
import { useIntl } from "./hooks/useIntl";
import { getMetaString } from "./game-data-utils";
import { Theme, useTheme } from "./theme-toggle";
import { useIsNarrow } from "./hooks/useMediaQuery";
import { Song } from "./models/SongData";

interface Props {
  songs: Song[];
}

export function DiffHistogram({ songs }: Props) {
  const { t } = useIntl();
  const fgColor = useTheme() === Theme.Dark ? "white" : undefined;
  const isNarrow = useIsNarrow();
  const allDiffs = useDrawState((s) => s.gameData?.meta.difficulties) || [];
  let minYear = 2015;
  let maxYear = 2023;
  const data = useMemo(() => {
    const countByYear = new CountingSet<string>();
    for (const song of songs) {
      const year = song.year;
      if (!year) continue;
      countByYear.add(year);
    }
    return {
      color: "red",
      label: "Year Released",
      data: Array.from(countByYear.valuesWithCount()).map(([year, count]) => ({
        year,
        count,
      })),
    };
  }, [songs]);

  return (
    <VictoryChart
      domainPadding={{ x: 50 }}
      style={{
        parent: { height: isNarrow ? "200px" : "300px", touchAction: "auto" },
      }}
      width={isNarrow ? 600 : 800}
    >
      <VictoryBar
        data={data.data}
        labels={data.data.map((d) => d.count.toString())}
        style={{
          labels: { fill: fgColor },
        }}
        x="year"
        y="count"
      />
      <VictoryAxis
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

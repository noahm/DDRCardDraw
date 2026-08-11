import { useMemo } from "react";
import { useConfigState } from "../config-state";
import { useDrawState } from "../draw-state";
import { formatLevel, getChartLvlBands } from "../lvl-display";
import {
  CHART_PLACEHOLDER,
  DrawnChart,
  EligibleChart,
  PlayerPickPlaceholder,
} from "../models/Drawing";

export function ChartLevel(props: {
  chart: EligibleChart | DrawnChart | PlayerPickPlaceholder;
}) {
  const useGranular = useConfigState((s) => s.useGranularLevels);
  const gameData = useDrawState((s) => s.gameData);
  const bands = useMemo(
    () => getChartLvlBands(gameData, useGranular),
    [gameData, useGranular],
  );
  if ("type" in props.chart && props.chart.type === CHART_PLACEHOLDER) {
    return "???";
  }
  return formatLevel(props.chart, useGranular, bands);
}

import { useConfigState } from "../state/hooks";
import { formatLevel } from "../game-data-utils";
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
  if ("type" in props.chart && props.chart.type === CHART_PLACEHOLDER) {
    return "???";
  }
  return formatLevel(props.chart, useGranular);
}

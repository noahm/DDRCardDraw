import { useConfigState } from "../config-state";
import { formatLevel } from "../game-data-utils";
import { EligibleChart } from "../models/Drawing";

export function ChartLevel(props: { chart: EligibleChart }) {
  const useGranular = useConfigState((s) => s.useGranularLevels);
  return formatLevel(props.chart, useGranular);
}

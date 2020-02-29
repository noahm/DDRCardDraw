import { Song, Chart } from "../models/SongData";
import { useCallback, useContext } from "preact/hooks";
import { ConfigState, ConfigStateContext } from "../config-state";

type ChartFilter = (song: Song, chart: Chart) => boolean;

function chartFilter(config: ConfigState, song: Song, chart: Chart): boolean {
  const { style, flags, difficulties, lowerBound, upperBound } = config;
  if (chart.style !== style) {
    return false;
  }
  if (!difficulties.has(chart.diffClass)) {
    return false;
  }
  if (chart.lvl < lowerBound || chart.lvl > upperBound) {
    return false;
  }
  if (song.flags && !song.flags.every(f => flags.has(f))) {
    return false;
  }
  if (chart.flags && !chart.flags.every(f => flags.has(f))) {
    return false;
  }
  return true;
}

export function useChartFilter(): ChartFilter {
  const configState = useContext(ConfigStateContext);
  return useCallback<ChartFilter>(chartFilter.bind({}, configState), [
    configState
  ]);
}

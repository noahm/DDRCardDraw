import { EligibleChart } from "../models/Drawing";
import { Chart } from "../models/SongData";

/**
 * The number a chart is ranked by: its level, its granular tier, or the draw
 * group a game uses in place of either.
 *
 * Lives apart from the rest of the game data helpers because it is plain data
 * handling with no UI attached, and the config store and the party server's
 * migrations both reach it without wanting React along for the ride.
 *
 * @param chart
 * @param useGranularLevels
 * @param includeTier default: `true`
 * @returns the effective level or tier
 */
export function chartLevelOrTier(
  chart: Pick<Chart, "lvl" | "sanbaiTier" | "drawGroup"> | EligibleChart,
  useGranularLevels: boolean,
  includeTier = true,
): number {
  if (includeTier && typeof chart.drawGroup === "number") {
    return chart.drawGroup;
  }
  const coreLevel = "lvl" in chart ? chart.lvl : chart.level;
  const granularLevel = "lvl" in chart ? chart.sanbaiTier : chart.granularLevel;
  if (useGranularLevels) {
    return granularLevel || coreLevel;
  } else {
    return coreLevel;
  }
}

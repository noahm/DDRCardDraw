import { useIntl } from "./hooks/useIntl";
import { EligibleChart } from "./models/Drawing";
import { Chart, GameData, I18NDict } from "./models/SongData";

export function getMetaString(t: (key: string) => string, key: string) {
  return t("meta." + key);
}

export function MetaString({ key }: { key: string }) {
  const { t } = useIntl();
  return <>{getMetaString(t, key)}</>;
}

export function getDiffClass(t: (key: string) => string, diffClassKey: string) {
  return t("meta.$abbr." + diffClassKey);
}

interface AbbrProps {
  diffClass: string;
}

export function AbbrDifficulty({ diffClass }: AbbrProps) {
  const { t } = useIntl();
  return <>{getDiffClass(t, diffClass)}</>;
}

/**
 * cached per game data file, since this walks every chart and gets called from
 * render paths (bucket controls, song search) on every config change
 */
const availableLevelCache = new WeakMap<GameData, Map<string, number[]>>();

/**
 * get a sorted list of unique difficutly levels (or tiers) from a game data file
 * @credit Albert Shin, from albshin/PerformaiCardDraw
 */
export function getAvailableLevels(
  gameData: GameData | null,
  useGranular = false,
  ignoreTiers = false,
): number[] {
  if (gameData === null) {
    return [];
  }

  let cachedForGame = availableLevelCache.get(gameData);
  if (!cachedForGame) {
    cachedForGame = new Map();
    availableLevelCache.set(gameData, cachedForGame);
  }
  const cacheKey = `${useGranular}:${ignoreTiers}`;
  const cached = cachedForGame.get(cacheKey);
  if (cached) {
    return cached;
  }

  const levelSet = new Set<number>();
  for (const song of gameData.songs) {
    for (const chart of song.charts) {
      levelSet.add(
        chartLevelOrTier(
          chart,
          useGranular,
          ignoreTiers ? false : gameData.meta.usesDrawGroups,
        ),
      );
    }
  }
  const levels = [...levelSet].sort((a, b) => a - b);
  cachedForGame.set(cacheKey, levels);
  return levels;
}

// export function getAvailableFolders(gameData: GameData | null): string[] {
//   if (gameData === null) {
//     return [];
//   }

//   const folderSet = new Set<string>();
//   for (const song of gameData.songs) {
//     if (song.folder) {
//       folderSet.add(song.folder);
//     }
//   }
//   return [...folderSet].sort((a, b) => (a < b ? -1 : 1));
// }

export function getDiffAbbr(gameData: GameData, diffClass: string) {
  return ((gameData.i18n.en as I18NDict)["$abbr"] as I18NDict)[
    diffClass
  ] as string;
}

/**
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

export function formatLevel(chart: EligibleChart, useGranular: boolean) {
  if (useGranular) {
    return (chart.granularLevel || chart.level).toFixed(2);
  } else {
    return chart.level;
  }
}

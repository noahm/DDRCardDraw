import { useCallback } from "react";
import { useIntl } from "./hooks/useIntl";
import { EligibleChart } from "./models/Drawing";
import { GameData, I18NDict } from "./models/SongData";
import { chartLevelOrTier } from "./utils/chart-level";
import { useConfigState } from "./state/hooks";

export function useGetMetaString() {
  const { t } = useIntl();
  const gameKey = useConfigState((c) => c.gameKey);
  return useCallback(
    (key: string) => t(`game.${gameKey}.${key}`),
    [gameKey, t],
  );
}

export function MetaString({ key }: { key: string }) {
  const getMetaString = useGetMetaString();
  return <>{getMetaString(key)}</>;
}

export function useGetDiffClass() {
  const { t } = useIntl();
  const gameKey = useConfigState((c) => c.gameKey);
  return useCallback(
    (diffClassKey: string) => t(`game.${gameKey}.$abbr.${diffClassKey}`),
    [gameKey, t],
  );
}

interface AbbrProps {
  diffClass: string;
}

export function AbbrDifficulty({ diffClass }: AbbrProps) {
  const getDiffClass = useGetDiffClass();
  return <>{getDiffClass(diffClass)}</>;
}

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
  return [...levelSet].sort((a, b) => a - b);
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

export function formatLevel(chart: EligibleChart, useGranular: boolean) {
  if (useGranular) {
    return (chart.granularLevel || chart.level).toFixed(2);
  } else {
    return chart.level;
  }
}

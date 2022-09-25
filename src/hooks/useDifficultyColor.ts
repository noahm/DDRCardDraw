import { useDrawState } from "../draw-state";

/**
 * Returns the CSS color specified in the game file metadata for a given difficulty
 */
export function useDifficultyColor(difficultyClass: string): string {
  const gameData = useDrawState((s) => s.gameData);
  const diffAccentColor =
    gameData?.meta.difficulties.find((d) => d.key === difficultyClass)?.color ||
    "";
  return diffAccentColor;
}

import { useContext } from "preact/hooks";
import { DrawStateContext } from "../draw-state";

/**
 * Returns the CSS color specified in the game file metadata for a given difficulty
 */
export function useDifficultyColor(difficultyClass: string): string {
  const { gameData } = useContext(DrawStateContext);
  const diffAccentColor =
    gameData?.meta.difficulties.find(d => d.key === difficultyClass)?.color ||
    "";
  return diffAccentColor;
}

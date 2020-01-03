import { useContext } from "preact/hooks";
import { DrawStateContext } from "../draw-state";

export function useDifficultyColor(difficultyClass: string): string {
  const { gameData } = useContext(DrawStateContext);
  const diffAccentColor =
    gameData?.meta.difficulties.find(d => d.key === difficultyClass)?.color ||
    "";
  return diffAccentColor;
}

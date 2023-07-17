import { GameData } from "../models/SongData";

/**
 * Returns the CSS color specified in the game file metadata for a given difficulty
 */
export function getDifficultyColor(
  gameData: GameData,
  difficultyClass: string,
): string {
  return (
    gameData.meta.difficulties.find((d) => d.key === difficultyClass)?.color ||
    ""
  );
}

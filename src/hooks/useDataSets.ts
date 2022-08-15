import shallow from "zustand/shallow";
import { useDrawState } from "../draw-state";

export const available = process.env.DATA_FILES as unknown as Array<{
  name: string;
  display: string;
}>;

available.sort((a, b) => (a.display < b.display ? -1 : 1));

export function useDataSets() {
  const [dataSetName, loadGameData, dataIsLoaded] = useDrawState(
    (s) => [s.dataSetName, s.loadGameData, !!s.gameData],
    shallow
  );
  const current = available.find((s) => s.name === dataSetName) || available[0];
  return { available, current, loadData: loadGameData, dataIsLoaded };
}

import { shallow } from "zustand/shallow";
import { useDrawState } from "../draw-state";
import { availableGameData as available } from "../utils";

export function useDataSets() {
  const [dataSetName, loadGameData, dataIsLoaded] = useDrawState(
    (s) => [s.dataSetName, s.loadGameData, !!s.gameData],
    shallow,
  );
  const current = available.find((s) => s.name === dataSetName) || available[0];
  return { available, current, loadData: loadGameData, dataIsLoaded };
}

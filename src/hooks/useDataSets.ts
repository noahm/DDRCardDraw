import { useContext } from "react";
import { DrawStateContext } from "../draw-state";

export const available = process.env.DATA_FILES as unknown as Array<{
  name: string;
  display: string;
}>;

available.sort((a, b) => (a.display < b.display ? -1 : 1));

export function useDataSets() {
  const { dataSetName, loadGameData } = useContext(DrawStateContext);
  const current = available.find((s) => s.name === dataSetName) || available[0];
  return { available, current, loadData: loadGameData };
}

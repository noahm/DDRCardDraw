import { useContext } from "react";
import { DrawStateContext } from "../draw-state";

export const available = process.env.DATA_FILES as unknown as Array<{
  name: string;
  display: string;
}>;

export function useDataSets() {
  const { dataSetName, loadGameData } = useContext(DrawStateContext);
  const current = available.find((s) => s.name === dataSetName) || available[0];
  return { available, current, loadData: loadGameData };
}

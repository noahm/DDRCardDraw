import { useCallback, useMemo } from "react";
import { availableGameData } from "../utils";
import { useAppDispatch, useAppState } from "../state/store";
import { gameDataSlice } from "../state/game-data.slice";
import {
  customDataCache,
  gameDataLoadingStatus,
} from "../state/game-data.atoms";
import { useAtomValue } from "jotai";

export function useDataSets() {
  const dataSetName = useAppState((s) => s.gameData.dataSetName);
  const dispatch = useAppDispatch();
  const importedData = useAtomValue(customDataCache);
  const dataLoadingState = useAtomValue(gameDataLoadingStatus);

  const loadGameData = useCallback(
    (name: string) => {
      if (importedData[name]) {
        dispatch(
          gameDataSlice.actions.selectGameData({
            dataSetName: name,
            dataType: "custom",
          }),
        );
      } else {
        dispatch(
          gameDataSlice.actions.selectGameData({
            dataSetName: name,
            dataType: "stock",
          }),
        );
      }
    },
    [dispatch, importedData],
  );

  const available = useMemo(() => {
    return [
      ...availableGameData,
      ...Object.values(importedData).map((d) => ({
        name: d.i18n.en.name as string,
        display: d.i18n.en.name as string,
        parent: d.meta.menuParent || "imported",
      })),
    ];
  }, [importedData]);

  const current: (typeof availableGameData)[0] = available.find(
    (s) => s.name === dataSetName,
  ) || { display: "Select game data", name: "", parent: "" };

  return {
    available,
    current,
    loadData: loadGameData,
    dataIsLoaded: dataLoadingState === "available",
  };
}

import { useCallback, useMemo } from "react";
import { availableGameData } from "../utils";
import { useAppDispatch, useAppState } from "../state/store";
import { gameDataSlice } from "../state/game-data.slice";
import { GameData } from "../models/SongData";
import { loadGameDataByName } from "../state/thunks";

export function useDataSets() {
  const dataSetName = useAppState((s) => s.gameData.dataSetName);
  const dispatch = useAppDispatch();
  const dataIsLoaded = useAppState((s) => !!s.gameData);
  const importedData = useAppState((s) => s.gameData.uploadCache);

  const loadGameData = useCallback(
    (name: string, gameData?: GameData) => {
      if (gameData) {
        dispatch(
          gameDataSlice.actions.selectCustomData({
            name,
            gameData,
          }),
        );
      } else if (importedData[name]) {
        dispatch(
          gameDataSlice.actions.selectCustomData({
            name,
            gameData: importedData[name],
          }),
        );
      } else {
        dispatch(loadGameDataByName(name));
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

  const current = available.find((s) => s.name === dataSetName) || available[0];

  return {
    available,
    current,
    loadData: loadGameData,
    dataIsLoaded,
  };
}

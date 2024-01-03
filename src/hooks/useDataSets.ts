import { useMemo } from "react";
import { useDrawState } from "../draw-state";
import { availableGameData } from "../utils";

export function useDataSets() {
  const dataSetName = useDrawState((s) => s.dataSetName);
  const loadGameData = useDrawState((s) => s.loadGameData);
  const dataIsLoaded = useDrawState((s) => !!s.gameData);
  const importedData = useDrawState((s) => s.importedData);

  const available = useMemo(() => {
    return [
      ...availableGameData,
      ...Array.from(importedData.values()).map((d) => ({
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

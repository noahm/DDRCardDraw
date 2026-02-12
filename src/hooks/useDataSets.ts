import { useMemo } from "react";
import { availableGameData } from "../utils";
import { customDataCache } from "../state/game-data.atoms";
import { useAtomValue } from "jotai";

export function useDataSets() {
  const importedData = useAtomValue(customDataCache);

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

  return {
    available,
  };
}

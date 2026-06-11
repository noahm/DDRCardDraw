import { useMemo } from "react";
import { availableGameData } from "../utils";
import { useAppState } from "../state/store";

export function useDataSets() {
  const importedData = useAppState((s) => s.customGameData);

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

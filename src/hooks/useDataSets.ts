import { useMemo } from "react";
import { availableGameData, CUSTOM_DATA_PARENT } from "../utils";
import { customDataCache } from "../state/game-data.atoms";
import { useAtomValue } from "jotai";

export function useDataSets() {
  const importedData = useAtomValue(customDataCache);

  const available = useMemo(() => {
    return [
      ...availableGameData,
      // Custom sets are keyed by their cache key. For a bundle attached by URL
      // that key *is* the URL, so selecting it sets `config.gameKey` to the URL —
      // a reference every synced peer can resolve to the same immutable bundle.
      ...Object.entries(importedData).map(([key, d]) => ({
        name: key,
        display: d.i18n.en.name as string,
        // Always grouped under the "Custom Data" folder, regardless of any
        // menuParent carried over from the stock data it was built on.
        parent: CUSTOM_DATA_PARENT,
      })),
    ];
  }, [importedData]);

  return {
    available,
  };
}

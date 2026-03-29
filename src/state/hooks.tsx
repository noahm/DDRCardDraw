import { createContext, useCallback, useContext } from "react";
import type { ConfigState } from "./config.slice";
import { useStockGameData } from "./game-data.atoms";
import { useRoomState } from "../jazz/app-state-context";
import { useRoom } from "../jazz/room-context";
import { useMutations } from "../jazz/use-mutations";
import { findJazzConfig, jazzConfigToConfig } from "../jazz/converters";

const configContext = createContext<string | null>(null);

export const ConfigContextProvider = configContext.Provider;

export function useConfigId() {
  const id = useContext(configContext);
  if (!id) {
    throw new Error("config id used without provider parent");
  }
  return id;
}

export function useConfigState<T = ConfigState>(
  selector?: (state: ConfigState) => T,
) {
  const configId = useConfigId();
  return useRoomState((state) => {
    const configObj = state.config.entities[configId];
    if (!selector) return configObj as T;
    return selector(configObj);
  });
}

export function useGameData() {
  const gameKey = useConfigState((c) => c.gameKey);
  return useStockGameData(gameKey);
}

export function useUpdateConfig() {
  const configId = useConfigId();
  const { room } = useRoom();
  const mutations = useMutations();
  return useCallback(
    (
      patch:
        | Partial<ConfigState>
        | ((state: ConfigState) => Partial<ConfigState>),
    ) => {
      const updates =
        typeof patch === "function"
          ? patch(jazzConfigToConfig(findJazzConfig(room, configId)!))
          : patch;
      mutations.updateConfig(configId, updates);
    },
    [room, mutations, configId],
  );
}

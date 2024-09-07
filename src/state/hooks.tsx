import { useAppDispatch, useAppState } from "./store";
import { EqualityFn } from "react-redux";
import { createContext, ReactNode, useCallback, useContext } from "react";
import { configSlice, type ConfigState } from "./config.slice";
import { useStockGameData } from "./game-data.atoms";

const configContext = createContext<string | null>(null);

export const ConfigContextProvider = configContext.Provider;
export function SelectedConfigContextProvider(props: { children: ReactNode }) {
  const selected = useAppState(configSlice.selectors.getCurrent);
  if (!selected) return null;
  return (
    <ConfigContextProvider value={selected.id}>
      {props.children}
    </ConfigContextProvider>
  );
}

function useConfigId() {
  const id = useContext(configContext);
  if (!id) {
    throw new Error("config id used without provider parent");
  }
  return id;
}

export function useConfigState<T = ConfigState>(
  selector?: (state: ConfigState) => T,
  equalityFn?: EqualityFn<T>,
) {
  const configId = useConfigId();
  return useAppState((state) => {
    const configObj = configSlice.selectors.selectById(state, configId);
    if (!selector) return configObj as T;
    return selector(configObj);
  }, equalityFn);
}

export function useGameData() {
  const gameKey = useConfigState((c) => c.gameKey);
  return useStockGameData(gameKey);
}

export function useUpdateConfig() {
  const configId = useConfigId();
  const dispatch = useAppDispatch();
  return useCallback(
    (
      patch:
        | Partial<ConfigState>
        | ((state: ConfigState) => Partial<ConfigState>),
    ) => {
      dispatch((dispatch, getState) => {
        if (typeof patch === "function") {
          const state = configSlice.selectors.selectById(getState(), configId);
          patch = patch(state);
        }
        dispatch(
          configSlice.actions.updateOne({ id: configId, changes: patch }),
        );
      });
    },
    [dispatch, configId],
  );
}

import { store, useAppDispatch, useAppState } from "./store";
import { EqualityFn } from "react-redux";
import { useCallback } from "react";
import { ConfigState } from "../config-state";
import { configSlice } from "./config.slice";

export function useConfigState<T = ConfigState>(
  selector?: (state: ConfigState) => T,
  equalityFn?: EqualityFn<T>,
) {
  return useAppState((state) => {
    const sliceState = configSlice.selectSlice(state);
    if (!selector) return sliceState as T;
    return selector(sliceState);
  }, equalityFn);
}

export function useUpdateConfig() {
  const dispatch = useAppDispatch();
  return useCallback(
    (
      patch:
        | Partial<ConfigState>
        | ((state: ConfigState) => Partial<ConfigState>),
    ) => {
      if (typeof patch === "function") {
        const state = configSlice.selectSlice(store.getState());
        patch = patch(state);
      }
      dispatch(configSlice.actions.update(patch));
    },
    [dispatch],
  );
}

import { useAppDispatch, useAppState } from "./store";
import { EqualityFn } from "react-redux";
import { createContext, useCallback, useContext } from "react";
import { configSlice, type ConfigState, defaultConfig } from "./config.slice";
import {
  defaultEventSettings,
  eventSlice,
  type EventSettings,
} from "./event.slice";
import { useGameDataForKey } from "./game-data.atoms";

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
  equalityFn?: EqualityFn<T>,
) {
  const configId = useConfigId();
  return useAppState((state) => {
    const configObj =
      configSlice.selectors.selectById(state, configId) || defaultConfig;
    if (!selector) return configObj as T;
    return selector(configObj);
  }, equalityFn);
}

export function useGameData() {
  const gameKey = useConfigState((c) => c.gameKey);
  return useGameDataForKey(gameKey);
}

/**
 * Read the event's global settings. Unlike a config there is no id to pick —
 * a room has exactly one of these, shared by everyone in it.
 */
export function useEventSettings<T = EventSettings>(
  selector?: (settings: EventSettings) => T,
  equalityFn?: EqualityFn<T>,
) {
  return useAppState((state) => {
    // a room persisted before these settings existed hasn't been migrated yet
    const settings = state.event?.settings || defaultEventSettings;
    if (!selector) return settings as T;
    return selector(settings);
  }, equalityFn);
}

export function useUpdateEventSettings() {
  const dispatch = useAppDispatch();
  return useCallback(
    (patch: Partial<EventSettings>) => {
      dispatch(eventSlice.actions.updateSettings(patch));
    },
    [dispatch],
  );
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

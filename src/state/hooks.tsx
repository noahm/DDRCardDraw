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
import { useLocalSettings } from "./local-settings.atoms";

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

const hideVetosContext = createContext<boolean | null>(null);

/**
 * States "hide vetos" outright for the cards rendered inside, in place of this
 * browser's own setting. An OBS source is the one client that needs it: it's a
 * browser in a scene nobody ever opens settings in, so the stub that renders
 * it reads the answer off the url instead. `null` -- the default, and what the
 * app itself provides -- means use the local setting.
 */
export const HideVetosOverrideProvider = hideVetosContext.Provider;

/** whether banned charts should be hidden here: an override if one is in scope, else this browser's own setting */
export function useHideVetos() {
  const override = useContext(hideVetosContext);
  const { hideVetos } = useLocalSettings();
  return override ?? hideVetos;
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

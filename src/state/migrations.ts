import { migratePlayersToIds, migrateToSubdraws } from "./drawings.slice";
import {
  addObsLabels,
  defaultEventSettings,
  EventSettings,
} from "./event.slice";
import type { AppState } from "./root-reducer";

/** mutates `state` to apply any necessary migrations */
export function applyMigrations(state: AppState) {
  if (state.drawings) {
    migrateToSubdraws(state.drawings);
    migratePlayersToIds(state.drawings);
  }
  if (state.event) addObsLabels(state.event);
  liftDisplaySettingsToEvent(state);
}

/** display settings that used to live on every config, before they were promoted */
const PROMOTED_KEYS: Array<keyof EventSettings> = ["hideVetos", "showMaxScore"];

/**
 * `hideVetos` and `showMaxScore` were per-config until they were promoted to
 * the event, so lift whichever values a saved room already had rather than
 * silently resetting them, then strip the dead keys so they can't ride along
 * in an exported config and come back later.
 *
 * A room with several configs can only have disagreed with itself here, and
 * neither answer is more correct than the other, so a setting any config had
 * turned on stays on — better to keep a deliberate choice than to lose it.
 */
function liftDisplaySettingsToEvent(state: AppState) {
  if (!state.event) return;
  const alreadyLifted = !!state.event.settings;
  const settings = { ...defaultEventSettings, ...state.event.settings };

  for (const id of state.config?.ids || []) {
    // the keys are gone from ConfigState, so reach them as plain object entries
    const config = state.config.entities[id] as unknown as
      | Record<string, unknown>
      | undefined;
    if (!config) continue;
    for (const key of PROMOTED_KEYS) {
      const legacyValue = config[key];
      if (typeof legacyValue !== "boolean") continue;
      if (!alreadyLifted && legacyValue) settings[key] = true;
      delete config[key];
    }
  }

  state.event.settings = settings;
}

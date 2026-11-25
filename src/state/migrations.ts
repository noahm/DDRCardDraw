import { migratePlayersToIds, migrateToSubdraws } from "./drawings.slice";
import {
  addObsLabels,
  defaultEventSettings,
  EventSettings,
} from "./event.slice";
import type { AppState } from "./root-reducer";
import { adoptLegacyChartSort } from "../chart-sort";

/** mutates `state` to apply any necessary migrations */
export function applyMigrations(state: AppState) {
  if (state.drawings) {
    migrateToSubdraws(state.drawings);
    migratePlayersToIds(state.drawings);
  }
  if (state.event) addObsLabels(state.event);
  migrateDisplaySettings(state);
  migrateChartSort(state);
}

/**
 * Display settings that used to live on every config, before they were
 * promoted. Spelled out rather than typed as `keyof EventSettings` so the
 * boolean write below stays sound now that not every setting is a boolean.
 */
const PROMOTED_KEYS = ["showMaxScore"] as const satisfies ReadonlyArray<
  keyof EventSettings
>;

/**
 * `hideVetos` went the other way. It was per-config, then briefly the room's,
 * and is now each browser's own (`state/local-settings.atoms.ts`) — because
 * the stream and the person at the cab want opposite answers, and one shared
 * value can't give both. A saved room still carries whatever it was set to,
 * which nothing reads any more, so drop it wherever one turns up rather than
 * leave a value that looks live.
 *
 * Nothing worth keeping is lost: the room's old answer isn't any client's, and
 * whoever wants it back is one checkbox away from it.
 */
const NOW_PER_BROWSER_KEYS = ["hideVetos"] as const;

/**
 * Carries a saved room's display settings to wherever they live now: lifts the
 * promoted ones off its configs onto the event, and clears out the ones that
 * have since become each browser's own.
 *
 * A room with several configs can only have disagreed with itself about a
 * promoted setting, and neither answer is more correct than the other, so one
 * any config had turned on stays on — better to keep a deliberate choice than
 * to lose it.
 */
function migrateDisplaySettings(state: AppState) {
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
    for (const key of NOW_PER_BROWSER_KEYS) {
      delete config[key];
    }
  }

  // likewise for a room that saved one while it was still the event's
  const looseSettings = settings as unknown as Record<string, unknown>;
  for (const key of NOW_PER_BROWSER_KEYS) {
    delete looseSettings[key];
  }

  state.event.settings = settings;
}

/**
 * Every config names the order its draws come out in, where it used to hold a
 * single "sort by chart level" checkbox. A saved room carries whichever answer
 * it was set to, so carry it across rather than resetting everyone's draws to
 * the default order.
 */
function migrateChartSort(state: AppState) {
  for (const id of state.config?.ids || []) {
    const config = state.config.entities[id];
    if (config) adoptLegacyChartSort(config);
  }
}

import { migrateConfigsToBuckets } from "./config.slice";
import { migratePlayersToIds, migrateToSubdraws } from "./drawings.slice";
import { addObsLabels } from "./event.slice";
import type { AppState } from "./root-reducer";

/** mutates `state` to apply any necessary migrations */
export function applyMigrations(state: AppState) {
  if (state.drawings) {
    migrateToSubdraws(state.drawings);
    migratePlayersToIds(state.drawings);
  }
  if (state.config) migrateConfigsToBuckets(state.config);
  if (state.event) addObsLabels(state.event);
}

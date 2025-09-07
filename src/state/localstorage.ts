import { applyMigrations } from "./migrations";
import type { AppState } from "./root-reducer";

export const LOCAL_STATE_STORAGE_KEY = "ddrtools.classic.state";

export let preloadedState: AppState | undefined;

try {
  const persisted = localStorage.getItem(LOCAL_STATE_STORAGE_KEY);
  if (persisted) {
    preloadedState = JSON.parse(persisted);
    if (preloadedState) applyMigrations(preloadedState);
  }
} catch {
  // YOLO
}

import { applyMigrations } from "./migrations";
import type { AppState } from "./root-reducer";

export const LOCAL_STATE_STORAGE_KEY = "ddrtools.classic.state";

export let classicModeState: AppState | undefined;

try {
  const persisted = localStorage.getItem(LOCAL_STATE_STORAGE_KEY);
  if (persisted) {
    classicModeState = JSON.parse(persisted);
    if (classicModeState) applyMigrations(classicModeState);
  }
} catch {
  // YOLO
}

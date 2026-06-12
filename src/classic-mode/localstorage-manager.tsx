import { LOCAL_STATE_STORAGE_KEY } from "../state/localstorage";
import { useAppStore } from "../state/store";
import { useEffect } from "react";

/**
 * component that persists the redux state to localstorage with every change
 */
export function LocalStorageManager() {
  const store = useAppStore();
  useEffect(() => {
    return store.subscribe(() => {
      const state = store.getState();
      setTimeout(() => {
        const encoded = JSON.stringify(state);
        localStorage.setItem(LOCAL_STATE_STORAGE_KEY, encoded);
      });
    });
  }, [store]);
  return null;
}

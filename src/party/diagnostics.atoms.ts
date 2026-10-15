import { atom, getDefaultStore } from "jotai";

/**
 * Whether the connection diagnostics dialog is open. Global so the sync
 * problem toasts can link to it — they are shown from outside the react tree,
 * where the hamburger menu's local state is out of reach.
 */
export const diagnosticsDialogOpen = atom(false);

export function openDiagnosticsDialog() {
  getDefaultStore().set(diagnosticsDialogOpen, true);
}

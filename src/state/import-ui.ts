import { create } from "zustand";

/**
 * Shared UI state for the data-import flows. The trigger (the top-left "Data
 * Import" menu in the header) and the dialogs themselves (hosted alongside
 * `DropHandler`) live in different parts of the tree, so this small store wires
 * them together.
 */
interface ImportUiState {
  /**
   * Source of an ITG pack to parse, set either by a body drop or the manual
   * folder picker. Drives the ITG confirm/import dialog.
   */
  packSource: DataTransferItem | HTMLInputElement | null;
  itgInstructionsOpen: boolean;
  smxEditsOpen: boolean;
  setPackSource(this: void, source: DataTransferItem | HTMLInputElement): void;
  clearPackSource(this: void): void;
  openItgInstructions(this: void): void;
  closeItgInstructions(this: void): void;
  openSmxEdits(this: void): void;
  closeSmxEdits(this: void): void;
}

export const useImportUi = create<ImportUiState>((set) => ({
  packSource: null,
  itgInstructionsOpen: false,
  smxEditsOpen: false,
  setPackSource(source) {
    set({ packSource: source, itgInstructionsOpen: false });
  },
  clearPackSource() {
    set({ packSource: null });
  },
  openItgInstructions() {
    set({ itgInstructionsOpen: true });
  },
  closeItgInstructions() {
    set({ itgInstructionsOpen: false });
  },
  openSmxEdits() {
    set({ smxEditsOpen: true });
  },
  closeSmxEdits() {
    set({ smxEditsOpen: false });
  },
}));

import { useCallback, useEffect } from "react";
import { useSetAtom } from "jotai";
import { customDataDialogOpen, pendingPackDrop } from "./state/game-data.atoms";

function loadParserModule() {
  return import("simfile-parser/browser");
}

/**
 * Listens for a song pack folder dropped anywhere on the window and hands it to
 * the custom-data dialog, which opens straight into the ITG import form. Renders
 * nothing itself — mount it once per app mode, next to `CustomDataDialog`.
 */
export function DropHandler() {
  const setOpen = useSetAtom(customDataDialogOpen);
  const setPendingDrop = useSetAtom(pendingPackDrop);

  const handleDrop = useCallback(
    (evt: DragEvent) => {
      evt.preventDefault();
      if (evt.dataTransfer?.items.length !== 1) {
        return;
      }
      setPendingDrop(evt.dataTransfer.items[0]);
      setOpen(true);
    },
    [setOpen, setPendingDrop],
  );

  const handleDragOver = useCallback(async (e: Event) => {
    e.preventDefault();
    // preload parser as soon as a drag begins
    await loadParserModule();
  }, []);

  useEffect(() => {
    document.body.addEventListener("drop", handleDrop);
    document.body.addEventListener("dragover", handleDragOver);
    return () => {
      document.body.removeEventListener("drop", handleDrop);
      document.body.removeEventListener("dragover", handleDragOver);
    };
  }, [handleDrop, handleDragOver]);

  return null;
}

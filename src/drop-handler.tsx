import { useCallback, useEffect } from "react";
import { useSetAtom } from "jotai";
import { customDataDialogOpen, pendingDrop } from "./state/game-data.atoms";

function loadParserModule() {
  return import("simfile-parser/browser");
}

/** A dropped item is a premade data file (rather than a pack) iff it's a `.json` file. */
function droppedJsonFile(item: DataTransferItem): File | null {
  if (item.kind !== "file") return null;
  const file = item.getAsFile();
  if (!file) return null;
  return file.type === "application/json" || /\.json$/i.test(file.name)
    ? file
    : null;
}

/**
 * Listens for a song pack (folder or `.zip`) or a premade data `.json` file dropped
 * anywhere on the window and hands it to the custom-data dialog, which opens straight
 * into the matching import form. Renders nothing itself — mount it once per app
 * mode, next to `CustomDataDialog`.
 */
export function DropHandler() {
  const setOpen = useSetAtom(customDataDialogOpen);
  const setPendingDrop = useSetAtom(pendingDrop);

  const handleDrop = useCallback(
    (evt: DragEvent) => {
      evt.preventDefault();
      if (evt.dataTransfer?.items.length !== 1) {
        return;
      }
      const item = evt.dataTransfer.items[0];
      // The file has to be pulled out now: the item goes inert once the event ends.
      const json = droppedJsonFile(item);
      setPendingDrop(
        json ? { kind: "json", file: json } : { kind: "pack", item },
      );
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

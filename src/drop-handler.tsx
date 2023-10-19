import { useCallback, useEffect } from "react";
import { parsePack } from "simfile-parser/browser";
import { useDrawState } from "./draw-state";
import { getDataFileFromPack } from "./utils/itg-import";

export function DropHandler() {
  const loadGameData = useDrawState((s) => s.loadGameData);
  const handleDrop = useCallback(
    async (evt: DragEvent) => {
      console.log("handle drop");
      evt.preventDefault();
      if (!evt.dataTransfer) {
        return;
      }

      if (evt.dataTransfer.items.length !== 1) {
        console.error("too many items dropped");
        return;
      }
      try {
        const pack = await parsePack(evt.dataTransfer.items[0]);
        console.log(`parsed pack "${pack.name}" with ${pack.songCount} songs`);
        const data = getDataFileFromPack(pack);
        loadGameData(pack.name, data);
      } catch (e) {
        console.log(e);
      }
    },
    [loadGameData],
  );

  const handleDragOver = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    document.body.addEventListener("drop", handleDrop);
    document.body.addEventListener("dragover", handleDragOver);
    return () => {
      document.body.removeEventListener("drop", handleDrop);
      document.body.removeEventListener("dragover", handleDragOver);
    };
  });

  return null;
}

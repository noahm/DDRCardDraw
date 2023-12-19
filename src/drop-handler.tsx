import {
  Button,
  Classes,
  Dialog,
  DialogFooter,
  FormGroup,
  Switch,
} from "@blueprintjs/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PackWithSongs, parsePack } from "simfile-parser/browser";
import { useDrawState } from "./draw-state";
import { getDataFileFromPack } from "./utils/itg-import";
import { pause } from "./utils/pause";

export function DropHandler() {
  const [droppedFolder, setDroppedFolder] = useState<DataTransferItem | null>(
    null,
  );

  const handleClose = useCallback(() => {
    setDroppedFolder(null);
  }, []);

  const handleDrop = useCallback(async (evt: DragEvent) => {
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
      setDroppedFolder(evt.dataTransfer.items[0]);
    } catch (e) {
      console.log(e);
    }
  }, []);

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

  return (
    <ConfirmPackDialog
      droppedFolder={droppedFolder}
      onClose={handleClose}
      onSave={handleClose}
    />
  );
}

interface DialogProps {
  droppedFolder: DataTransferItem | null;
  onSave(): void;
  onClose(): void;
}

function ConfirmPackDialog({ droppedFolder, onClose, onSave }: DialogProps) {
  const [parsedPack, setParsedPack] = useState<PackWithSongs | null>(null);
  const [tiered, setTiered] = useState(false);
  useEffect(() => {
    if (!droppedFolder) {
      setParsedPack(null);
      return;
    }
    parsePack(droppedFolder).then((pack) => {
      setParsedPack(pack);
      if (
        pack.simfiles.every((song) => song.title.titleName.match(/^\[T\d\d\] /))
      ) {
        setTiered(true);
      } else {
        setTiered(false);
      }
    });
  }, [droppedFolder]);

  const derivedData = useMemo(() => {
    if (!parsedPack) {
      return;
    }
    return getDataFileFromPack(parsedPack, tiered);
  }, [parsedPack, tiered]);

  const loadGameData = useDrawState((s) => s.addImportedData);
  const [saving, setSaving] = useState(false);
  const handleConfirm = useCallback(() => {
    if (!parsedPack || !derivedData) {
      return;
    }
    setSaving(true);
    loadGameData(parsedPack.name, derivedData);
    pause(500).then(() => {
      setSaving(false);
      onSave();
    });
  }, [parsedPack, derivedData, loadGameData, onSave]);

  const maybeSkeleton = derivedData ? "" : Classes.SKELETON;

  return (
    <Dialog
      isOpen={!!droppedFolder}
      title="Local Data Import"
      onClose={onClose}
    >
      <div style={{ padding: "10px" }}>
        <p className={maybeSkeleton}>
          Pack name: {parsedPack ? parsedPack.name : "to be determined"}
        </p>
        <FormGroup>
          <Switch
            label="Tiered"
            checked={tiered}
            onChange={() => setTiered((prev) => !prev)}
          />
        </FormGroup>
        <dl className={maybeSkeleton}>
          <dt>Total Songs</dt>
          <dd>{parsedPack ? parsedPack.songCount : 50}</dd>
          <dt>Total Charts</dt>
          <dd>
            {derivedData
              ? derivedData.songs.reduce(
                  (total, item) => total + item.charts.length,
                  0,
                )
              : 50}
          </dd>
        </dl>
      </div>
      <DialogFooter
        actions={
          <>
            <Button
              className={maybeSkeleton}
              intent="primary"
              onClick={handleConfirm}
              loading={saving}
              icon="import"
            >
              Import
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </>
        }
      />
    </Dialog>
  );
}

import {
  Button,
  Classes,
  Dialog,
  DialogFooter,
  FormGroup,
  Switch,
} from "@blueprintjs/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PackWithSongs } from "simfile-parser/browser";
import { useDrawState } from "./draw-state";
import { getDataFileFromPack } from "./utils/itg-import";
import { pause } from "./utils/pause";
import { convertErrorToString } from "./utils/error-to-string";
import { Import } from "@blueprintjs/icons";

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

function useDataParsing(
  droppedFolder: DataTransferItem | null,
  setTiered: (next: boolean) => void,
) {
  const [parsedPack, setParsedPack] = useState<PackWithSongs | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  useEffect(() => {
    setParseError(null);
    if (!droppedFolder) {
      setParsedPack(null);
      return;
    }
    import("simfile-parser/browser")
      .then(({ parsePack }) => parsePack(droppedFolder))
      .then((pack) => {
        setParsedPack(pack);
        if (
          pack.simfiles.every((song) =>
            song.title.titleName.match(/^\[T\d\d\] /),
          )
        ) {
          setTiered(true);
        } else {
          setTiered(false);
        }
      })
      .catch((rejection) => {
        setParsedPack(null);
        console.error(rejection);
        setParseError(convertErrorToString(rejection));
      });
  }, [droppedFolder, setTiered]);
  return {
    parsedPack,
    parseError,
  };
}

function ConfirmPackDialog({ droppedFolder, onClose, onSave }: DialogProps) {
  const [tiered, setTiered] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadGameData = useDrawState((s) => s.addImportedData);

  const { parsedPack, parseError } = useDataParsing(droppedFolder, setTiered);
  const derivedData = useMemo(() => {
    if (!parsedPack) {
      return;
    }
    return getDataFileFromPack(parsedPack, tiered);
  }, [parsedPack, tiered]);

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

  let body = (
    <>
      <p className={maybeSkeleton}>
        Pack name: {parsedPack ? parsedPack.name : "to be determined"}
      </p>
      <FormGroup>
        <Switch
          className={maybeSkeleton}
          label="Pack uses tiers"
          checked={tiered}
          onChange={() => setTiered((prev) => !prev)}
        />
      </FormGroup>
      <dl className={maybeSkeleton}>
        <dt>Total Songs</dt>
        <dd>{parsedPack ? parsedPack.songCount : "??"}</dd>
        <dt>Total Charts</dt>
        <dd>
          {derivedData
            ? derivedData.songs.reduce(
                (total, item) => total + item.charts.length,
                0,
              )
            : "??"}
        </dd>
      </dl>
    </>
  );

  if (parseError) {
    body = (
      <>
        <h1>Error importing pack</h1>
        <code style={{ whiteSpace: "pre-wrap" }}>{parseError}</code>
      </>
    );
  }

  return (
    <Dialog
      isOpen={!!droppedFolder}
      title="Local Data Import"
      onClose={onClose}
    >
      <div style={{ padding: "10px" }}>{body}</div>
      <DialogFooter
        actions={
          <>
            <Button
              disabled={!!maybeSkeleton}
              intent="primary"
              onClick={handleConfirm}
              loading={saving}
              icon={<Import />}
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

import {
  Button,
  Classes,
  Dialog,
  DialogFooter,
  FormGroup,
  Switch,
} from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import type { PackWithSongs } from "simfile-parser/browser";
import { getDataFileFromPack } from "./utils/itg-import";
import { convertErrorToString } from "./utils/error-to-string";
import { Import } from "@blueprintjs/icons";
import { useAppDispatch } from "./state/store";
import { customGameDataSlice } from "./state/custom-game-data.slice";
import { useRoomName } from "./hooks/useRoomName";
import { GameData } from "./models/SongData";

function loadParserModule() {
  return import("simfile-parser/browser");
}

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
  onSave(this: void): void;
  onClose(this: void): void;
}

function useDataParsing(
  droppedFolder: DataTransferItem | null,
  setTiered: (next: boolean) => void,
) {
  const [parsedPack, setParsedPack] = useState<PackWithSongs | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  useEffect(() => {
    // oxlint-disable-next-line react-hooks-js/set-state-in-effect
    setParseError(null);
    if (!droppedFolder) {
      setParsedPack(null);
      return;
    }
    loadParserModule()
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
  const [importError, setImportError] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  const roomName = useRoomName();

  const { parsedPack, parseError } = useDataParsing(droppedFolder, setTiered);

  const chartCount = parsedPack
    ? parsedPack.simfiles.reduce(
        (total, song) => total + song.availableTypes.length,
        0,
      )
    : undefined;

  const handleConfirm = useCallback(async () => {
    if (!parsedPack) {
      return;
    }
    setSaving(true);
    setImportError(null);
    try {
      const data: GameData = await getDataFileFromPack(
        parsedPack,
        roomName,
        tiered,
      );
      dispatch(
        customGameDataSlice.actions.add({ name: parsedPack.name, data }),
      );
      onSave();
    } catch (e) {
      setImportError(convertErrorToString(e));
    } finally {
      setSaving(false);
    }
  }, [parsedPack, roomName, tiered, dispatch, onSave]);

  const maybeSkeleton = parsedPack ? "" : Classes.SKELETON;

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
        <dd>{chartCount ?? "??"}</dd>
      </dl>
    </>
  );

  if (parseError || importError) {
    body = (
      <>
        <h1>Error importing pack</h1>
        <code style={{ whiteSpace: "pre-wrap" }}>
          {parseError || importError}
        </code>
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

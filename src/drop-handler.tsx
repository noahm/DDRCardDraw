import {
  Button,
  Callout,
  Dialog,
  DialogFooter,
  FormGroup,
  NonIdealState,
  Spinner,
  Switch,
} from "@blueprintjs/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PackWithSongs } from "simfile-parser/browser";
import { useDrawState } from "./draw-state";
import { getDataFileFromPack } from "./utils/itg-import";
import { pause } from "./utils/pause";
import { convertErrorToString } from "./utils/error-to-string";
import { Import } from "@blueprintjs/icons";

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
  const loadGameData = useDrawState((s) => s.addImportedData);

  const { parsedPack, parseError } = useDataParsing(droppedFolder, setTiered);
  const derived = useMemo(() => {
    if (!parsedPack) {
      return null;
    }
    try {
      return { data: getDataFileFromPack(parsedPack, tiered), error: null };
    } catch (e) {
      // usually a pack that doesn't actually use tiers. The pack itself parsed
      // fine, so keep it around and let the user flip the switch back off
      // rather than making them drop the whole thing again.
      console.error(e);
      return { data: null, error: convertErrorToString(e) };
    }
  }, [parsedPack, tiered]);
  const derivedData = derived?.data ?? null;
  const deriveError = derived?.error ?? null;

  const handleConfirm = useCallback(async () => {
    if (!parsedPack || !derivedData) {
      return;
    }
    setSaving(true);
    loadGameData(parsedPack.name, derivedData);
    await pause(500);
    setSaving(false);
    onSave();
  }, [parsedPack, derivedData, loadGameData, onSave]);

  let body: ReactNode;
  if (parseError) {
    // nothing usable came back, so there's nothing to recover to
    body = (
      <Callout intent="danger" title="Error importing pack">
        <code style={{ whiteSpace: "pre-wrap" }}>{parseError}</code>
      </Callout>
    );
  } else if (!parsedPack) {
    body = (
      <NonIdealState
        icon={<Spinner />}
        title="Parsing pack data"
        description="Large packs can take a moment to read."
      />
    );
  } else {
    body = (
      <>
        <p>Pack name: {parsedPack.name}</p>
        <FormGroup>
          <Switch
            label="Pack uses tiers"
            checked={tiered}
            onChange={() => setTiered((prev) => !prev)}
          />
        </FormGroup>
        {derivedData ? (
          <dl>
            <dt>Total Songs</dt>
            <dd>{parsedPack.songCount}</dd>
            <dt>Total Charts</dt>
            <dd>
              {derivedData.songs.reduce(
                (total, item) => total + item.charts.length,
                0,
              )}
            </dd>
          </dl>
        ) : (
          <Callout intent="danger" title="Couldn't read tiers from this pack">
            <code style={{ whiteSpace: "pre-wrap" }}>{deriveError}</code>
          </Callout>
        )}
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
              disabled={!derivedData}
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

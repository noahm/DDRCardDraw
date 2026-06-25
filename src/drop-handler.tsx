import {
  Button,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  Switch,
} from "@blueprintjs/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PackWithSongs } from "simfile-parser/browser";
import { useDrawState } from "./draw-state";
import { useImportUi } from "./state/import-ui";
import { getDataFileFromPack } from "./utils/itg-import";
import { pause } from "./utils/pause";
import { convertErrorToString } from "./utils/error-to-string";
import { FolderOpen, Import } from "@blueprintjs/icons";
import { SmxEditImport } from "./smx-edit-import";

function loadParserModule() {
  return import("simfile-parser/browser");
}

export function DropHandler() {
  const setPackSource = useImportUi((s) => s.setPackSource);

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
        setPackSource(evt.dataTransfer.items[0]);
      } catch (e) {
        console.log(e);
      }
    },
    [setPackSource],
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
  });

  return (
    <>
      <ItgInstructionsDialog />
      <ConfirmPackDialog />
      <SmxEditImport />
    </>
  );
}

/**
 * First step of the manual ITG import: explain what to select, then let the user
 * pick a pack folder with a native directory picker. The chosen folder flows
 * into the same confirm dialog used by drag/drop.
 */
function ItgInstructionsDialog() {
  const isOpen = useImportUi((s) => s.itgInstructionsOpen);
  const onClose = useImportUi((s) => s.closeItgInstructions);
  const setPackSource = useImportUi((s) => s.setPackSource);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(() => {
    const input = inputRef.current;
    if (input && input.files && input.files.length) {
      setPackSource(input);
    }
  }, [setPackSource]);

  return (
    <Dialog
      isOpen={isOpen}
      title="Import an ITG/StepMania Pack"
      icon={<FolderOpen />}
      onClose={onClose}
    >
      <DialogBody>
        <p>
          Choose the folder of the pack you&apos;d like to import. This is the
          folder that contains one subfolder per song (each with its own{" "}
          <code>.sm</code> or <code>.ssc</code> simfile).
        </p>
        <p>
          You can also drag and drop that folder anywhere onto this page to
          start the same import.
        </p>
        <input
          ref={inputRef}
          type="file"
          // @ts-expect-error non-standard attributes for directory selection
          webkitdirectory=""
          directory=""
          style={{ display: "none" }}
          onChange={handleChange}
        />
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button
              intent="primary"
              icon={<FolderOpen />}
              onClick={() => inputRef.current?.click()}
            >
              Choose folder…
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </>
        }
      />
    </Dialog>
  );
}

function useDataParsing(
  packSource: DataTransferItem | HTMLInputElement | null,
  setTiered: (next: boolean) => void,
) {
  const [parsedPack, setParsedPack] = useState<PackWithSongs | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  useEffect(() => {
    // oxlint-disable-next-line react-hooks-js/set-state-in-effect
    setParseError(null);
    if (!packSource) {
      setParsedPack(null);
      return;
    }
    loadParserModule()
      .then(({ parsePack }) => parsePack(packSource))
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
  }, [packSource, setTiered]);
  return {
    parsedPack,
    parseError,
  };
}

function ConfirmPackDialog() {
  const packSource = useImportUi((s) => s.packSource);
  const clearPackSource = useImportUi((s) => s.clearPackSource);
  const [tiered, setTiered] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadGameData = useDrawState((s) => s.addImportedData);

  const { parsedPack, parseError } = useDataParsing(packSource, setTiered);
  const derivedData = useMemo(() => {
    if (!parsedPack) {
      return;
    }
    return getDataFileFromPack(parsedPack, tiered);
  }, [parsedPack, tiered]);

  const handleConfirm = useCallback(async () => {
    if (!parsedPack || !derivedData) {
      return;
    }
    setSaving(true);
    loadGameData(parsedPack.name, derivedData);
    await pause(500);
    setSaving(false);
    clearPackSource();
  }, [parsedPack, derivedData, loadGameData, clearPackSource]);

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
      isOpen={!!packSource}
      title="Local Data Import"
      onClose={clearPackSource}
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
            <Button onClick={clearPackSource}>Cancel</Button>
          </>
        }
      />
    </Dialog>
  );
}

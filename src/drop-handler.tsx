import { Button, Group, Modal, Skeleton, Switch } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PackWithSongs } from "simfile-parser/browser";
import { getDataFileFromPack } from "./utils/itg-import";
import { pause } from "./utils/pause";
import { convertErrorToString } from "./utils/error-to-string";
import { IconFileImport } from "@tabler/icons-react";
import { useSetAtom } from "jotai";
import { customDataCache } from "./state/game-data.atoms";

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
  const setCustomData = useSetAtom(customDataCache);

  const { parsedPack, parseError } = useDataParsing(droppedFolder, setTiered);
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
    setCustomData((prev) => {
      return {
        ...prev,
        [parsedPack.name]: derivedData,
      };
    });
    await pause(500);
    setSaving(false);
    onSave();
  }, [parsedPack, derivedData, setCustomData, onSave]);

  const stillLoading = !derivedData;

  let body = (
    <>
      <Skeleton visible={stillLoading}>
        <p>Pack name: {parsedPack ? parsedPack.name : "to be determined"}</p>
        <Switch
          label="Pack uses tiers"
          mb="sm"
          checked={tiered}
          onChange={() => setTiered((prev) => !prev)}
        />
        <dl>
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
      </Skeleton>
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
    <Modal opened={!!droppedFolder} title="Local Data Import" onClose={onClose}>
      <div style={{ padding: "10px" }}>{body}</div>
      <Group justify="flex-end" gap="xs">
        <Button
          disabled={stillLoading}
          onClick={handleConfirm}
          loading={saving}
          leftSection={<IconFileImport size={16} />}
        >
          Import
        </Button>
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
      </Group>
    </Modal>
  );
}

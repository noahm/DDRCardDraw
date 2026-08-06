import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  InputGroup,
  TextArea,
  Text,
} from "@blueprintjs/core";
import { Import } from "@blueprintjs/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDrawState } from "./draw-state";
import { useIntl } from "./hooks/useIntl";
import { useImportUi } from "./state/import-ui";
import type { GameData } from "./models/SongData";
import {
  buildEditDataFile,
  fetchEditCharts,
  parseEditCodes,
  type BuildResult,
  type FetchEditsResult,
} from "./utils/smx-edit-import";
import { convertErrorToString } from "./utils/error-to-string";
import { toaster } from "./toaster";

function loadBaseSmxData(): Promise<GameData> {
  return import(/* webpackChunkName: "songData" */ "./songs/smx.json").then(
    (mod) => mod.default as GameData,
  );
}

const defaultName = "SMX with Edits!";

/**
 * Owns only the open/closed state of the dialog. The form (and all its state) is
 * a child that mounts when opened and unmounts when closed, so its state resets
 * implicitly on close — no manual reset logic.
 */
export function SmxEditImport() {
  const isOpen = useImportUi((s) => s.smxEditsOpen);
  const onClose = useImportUi((s) => s.closeSmxEdits);
  return (
    <Dialog
      isOpen={isOpen}
      title="Import StepManiaX Edits"
      icon={<Import />}
      onClose={onClose}
    >
      {isOpen && <EditImportForm onClose={onClose} />}
    </Dialog>
  );
}

function EditImportForm({ onClose }: { onClose: (this: void) => void }) {
  const { t } = useIntl();
  const addImportedData = useDrawState((s) => s.addImportedData);

  const [text, setText] = useState("");
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<FetchEditsResult | null>(null);

  const codes = useMemo(() => parseEditCodes(text), [text]);
  // stable primitive so the validation effect only re-runs when the set of
  // codes actually changes, not on every keystroke
  const codesKey = codes.join(",");

  // Validate against the API automatically (debounced) as the user pastes/edits,
  // so the import button is gated on a completed lookup.
  useEffect(() => {
    if (!codesKey) {
      setFetched(null);
      setFetching(false);
      setError(null);
      return;
    }
    let ignore = false;
    setFetching(true);
    setError(null);
    const handle = setTimeout(() => {
      fetchEditCharts(codesKey.split(","))
        .then((res) => {
          if (!ignore) setFetched(res);
        })
        .catch((e) => {
          if (ignore) return;
          console.error(e);
          setError(convertErrorToString(e));
          setFetched(null);
        })
        .finally(() => {
          if (!ignore) setFetching(false);
        });
    }, 500);
    return () => {
      ignore = true;
      clearTimeout(handle);
    };
  }, [codesKey]);

  const handleImport = useCallback(async () => {
    if (!fetched) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const base = await loadBaseSmxData();
      const result: BuildResult = buildEditDataFile(
        base,
        fetched.charts,
        name.trim() || defaultName,
      );
      addImportedData(result.data.i18n.en.name as string, result.data);
      const skipped = result.unknownSongs.length
        ? t("smxImport.skipped", { count: result.unknownSongs.length })
        : "";
      toaster?.show({
        intent: result.unknownSongs.length ? "warning" : "success",
        message: t("smxImport.imported", { count: result.matched }) + skipped,
      });
      onClose();
    } catch (e) {
      console.error(e);
      setError(convertErrorToString(e));
    } finally {
      setSaving(false);
    }
  }, [fetched, name, addImportedData, onClose, t]);

  return (
    <>
      <DialogBody>
        <FormGroup
          label="Data set name"
          helperText="Shown in the game picker as Imported data."
        >
          <InputGroup value={name} onChange={(e) => setName(e.target.value)} />
        </FormGroup>
        <FormGroup label="Paste edit links or codes">
          <TextArea
            fill
            style={{ height: "10em" }}
            value={text}
            placeholder={"Z8Z-W77\nhttps://edits.stepmaniax.com/W15-W2P"}
            onChange={(e) => setText(e.target.value)}
          />
        </FormGroup>
        <Text tagName="p">
          {t("smxImport.detected", { count: codes.length })}.{" "}
          {fetching
            ? t("smxImport.lookingUp")
            : fetched
              ? t("smxImport.found", { count: fetched.charts.length })
              : null}
        </Text>
        {error && (
          <Callout intent="danger" title="Something went wrong">
            <code style={{ whiteSpace: "pre-wrap" }}>{error}</code>
          </Callout>
        )}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button
              intent="primary"
              icon={<Import />}
              onClick={handleImport}
              loading={saving}
              disabled={fetching || !fetched?.charts.length}
            >
              {t("smxImport.importButton", {
                count: fetched?.charts.length ?? 0,
              })}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </>
        }
      />
    </>
  );
}

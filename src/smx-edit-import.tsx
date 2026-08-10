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
import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import {
  buildEditDataFile,
  fetchEditCharts,
  parseEditCodes,
  type FetchEditsResult,
} from "./utils/smx-edit-import";
import { useNavigate } from "react-router-dom";
import { publishBundle } from "./utils/publish-bundle";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "./utils/turnstile";
import {
  customDataDialogOpen,
  loadCustomGamedataByUrl,
} from "./state/game-data.atoms";
import { useAppDispatch } from "./state/store";
import { createConfigFromInputs } from "./state/thunks";
import { useSetLastConfigSelected } from "./state/config.atoms";
import type { GameData } from "./models/SongData";
import { toaster } from "./toaster";

/**
 * App-root host for the custom-data dialog, driven by the global
 * `customDataDialogOpen` atom so any entry point (hamburger menu, the game-data
 * picker's "Create custom data…" item) can open it. Rendered once in `App`.
 */
export function CustomDataDialog() {
  const [open, setOpen] = useAtom(customDataDialogOpen);
  return <SmxEditImport isOpen={open} onClose={() => setOpen(false)} />;
}

/** Lazily load (and code-split) the bundled stock SMX catalog to graft edits onto. */
function loadBaseSmxData(): Promise<GameData> {
  return import(/* webpackChunkName: "songData" */ "./songs/smx.json").then(
    (mod) => mod.default as unknown as GameData,
  );
}

/**
 * Owns only the open/closed state of the dialog. The form (and all its state) is
 * a child that mounts when opened and unmounts when closed, so its state resets
 * implicitly on close — no manual reset logic.
 */
export function SmxEditImport({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: (this: void) => void;
}) {
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

/**
 * Paste StepManiaX edit codes, look them up live, then publish an immutable bundle
 * to data.ddr.tools and load it into the in-memory cache so it becomes selectable in
 * the game-data picker — where selecting it sets a config's `gameKey` to the bundle
 * URL, a reference every synced peer resolves to the same immutable bytes.
 */
function EditImportForm({ onClose }: { onClose: (this: void) => void }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState<FetchEditsResult | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Turnstile token (null until solved). Only required when a site key is configured;
  // `widgetKey` is bumped after a failed attempt to mint a fresh single-use token.
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const setLastConfigSelected = useSetLastConfigSelected();

  const codes = useMemo(() => parseEditCodes(text), [text]);
  // stable primitive so the lookup effect only re-runs when the set of codes
  // actually changes, not on every keystroke
  const codesKey = codes.join(",");

  // Validate against the SMX API automatically (debounced) as the user pastes/edits,
  // so the publish button is gated on a completed lookup.
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
          setError(e instanceof Error ? e.message : String(e));
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

  async function publish() {
    if (!fetched) return;
    setPublishing(true);
    setError(null);
    try {
      const base = await loadBaseSmxData();
      const result = buildEditDataFile(base, fetched.charts, name.trim());
      const { url } = await publishBundle(
        result.data,
        {
          requestedCodes: codes,
          notFound: fetched.notFound,
          unknownSongs: result.unknownSongs,
        },
        token ?? undefined,
      );
      // Pull the stored, immutable bytes into customDataCache (which validates them
      // against the schema), making the set appear in the game-data picker.
      const loaded = await loadCustomGamedataByUrl(url);
      if (!loaded) {
        setError("Published, but the bundle didn't load back. Try again.");
        return;
      }
      // Create a config pointed at the freshly published bundle (its `gameKey` is the
      // immutable URL), select it, and open its config page.
      const newConfig = await dispatch(
        createConfigFromInputs(name.trim(), url),
      );
      // Remember it as the default selection for other entry points; the config page
      // itself reads the id straight from the URL below.
      setLastConfigSelected(newConfig.id);
      const skipped = result.unknownSongs.length
        ? ` ${result.unknownSongs.length} skipped — song not in the StepManiaX data yet.`
        : "";
      toaster.show({
        intent: result.unknownSongs.length ? "warning" : "success",
        icon: "import",
        message:
          `Published ${result.matched} edit${result.matched === 1 ? "" : "s"} — ` +
          `opened a new config for it.${skipped}`,
      });
      onClose();
      navigate("config/" + newConfig.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // The token may have been consumed server-side; remount for a fresh one so a
      // retry isn't rejected for reusing a single-use token.
      setToken(null);
      setWidgetKey((k) => k + 1);
    } finally {
      setPublishing(false);
    }
  }

  const foundCount = fetched?.charts.length ?? 0;
  return (
    <>
      <DialogBody>
        <FormGroup
          label="Data set name"
          helperText="Shown in the game data picker."
        >
          <InputGroup
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="SMX with Edits!"
          />
        </FormGroup>
        <FormGroup
          label="Paste edit links or codes"
          helperText="Edit charts are merged with a copy of the stock StepManiaX data and added as new game data for this event. It will disappear when left unused by all configs."
        >
          <TextArea
            fill
            style={{ height: "10em" }}
            value={text}
            placeholder={"Z8Z-W77\nhttps://edits.stepmaniax.com/W15-W2P"}
            onChange={(e) => setText(e.currentTarget.value)}
          />
        </FormGroup>
        <Text tagName="p">
          {codes.length
            ? `${codes.length} unique code${codes.length === 1 ? "" : "s"} detected. `
            : "No codes detected yet. "}
          {fetching
            ? "Looking them up…"
            : fetched
              ? `Found info for ${foundCount} chart${foundCount === 1 ? "" : "s"}.` +
                (fetched.notFound.length
                  ? ` ${fetched.notFound.length} not found.`
                  : "")
              : null}
        </Text>
        {error && (
          <Callout intent="danger" title="Something went wrong">
            <code style={{ whiteSpace: "pre-wrap" }}>{error}</code>
          </Callout>
        )}
        {/* No-op unless a site key is configured. With `interaction-only` appearance
            Cloudflare renders nothing (0x0) for most visitors and only grows the
            widget in when it actually needs a challenge from this session — no
            min-height/min-width here, since reserving space up front would defeat
            that. `maxWidth`/`maxHeight` are just a ceiling matching Cloudflare's
            documented "normal" box (300x65), a backstop rather than a real limit. */}
        <div style={{ maxWidth: 300, maxHeight: 65, overflow: "hidden" }}>
          <TurnstileWidget key={widgetKey} onToken={setToken} />
        </div>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button
              intent="primary"
              icon={<Import />}
              onClick={publish}
              loading={publishing}
              disabled={
                !name ||
                fetching ||
                !foundCount ||
                (!!TURNSTILE_SITE_KEY && !token)
              }
            >
              {`Publish${foundCount ? ` ${foundCount}` : ""}`}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </>
        }
      />
    </>
  );
}

import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  InputGroup,
  Menu,
  MenuItem,
  ProgressBar,
  Switch,
  TextArea,
  Text,
} from "@blueprintjs/core";
import { FolderOpen, Import } from "@blueprintjs/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import type { PackWithSongs } from "simfile-parser/browser";
import {
  buildEditDataFile,
  fetchEditCharts,
  parseEditCodes,
  type FetchEditsResult,
} from "./utils/smx-edit-import";
import { getDataFileFromPack } from "./utils/itg-import";
import {
  jacketUrlForHash,
  resizeAndHashJacket,
  type ResizedJacket,
} from "./utils/jacket-resize";
import { pickedFolderAsDropItem } from "./utils/picked-folder";
import { convertErrorToString } from "./utils/error-to-string";
import { useNavigate } from "react-router-dom";
import {
  publishBundle,
  publishBundleWithJackets,
} from "./utils/publish-bundle";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "./utils/turnstile";
import {
  customDataDialogOpen,
  loadCustomGamedataByUrl,
  pendingPackDrop,
} from "./state/game-data.atoms";
import { useAppDispatch } from "./state/store";
import { createConfigFromInputs } from "./state/thunks";
import { useSetLastConfigSelected } from "./state/config.atoms";
import { useIntl } from "./hooks/useIntl";
import type { GameData } from "./models/SongData";
import { toaster } from "./toaster";

type ImportSource = "smx" | "itg";

/**
 * App-root host for the custom-data dialog, driven by the global
 * `customDataDialogOpen` atom so any entry point (hamburger menu, the game-data
 * picker's "Create custom data…" item, a folder drop) can open it. Rendered once
 * per app mode.
 */
export function CustomDataDialog() {
  const [open, setOpen] = useAtom(customDataDialogOpen);
  return (
    <CreateCustomDataDialog isOpen={open} onClose={() => setOpen(false)} />
  );
}

/** Lazily load (and code-split) the bundled stock SMX catalog to graft edits onto. */
function loadBaseSmxData(): Promise<GameData> {
  return import(/* webpackChunkName: "songData" */ "./songs/smx.json").then(
    (mod) => mod.default as unknown as GameData,
  );
}

function loadParserModule() {
  return import("simfile-parser/browser");
}

/**
 * Owns which import source is being used and the dialog's open/closed state. The
 * forms (and all their state) are children that mount when opened and unmount
 * when closed, so their state resets implicitly on close — no manual reset logic.
 */
export function CreateCustomDataDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: (this: void) => void;
}) {
  const { t } = useIntl();
  const [chosen, setChosen] = useState<ImportSource | null>(null);
  const [droppedFolder, setDroppedFolder] = useAtom(pendingPackDrop);
  // Dropping a folder says which importer is wanted, so it skips the chooser.
  const source = chosen ?? (droppedFolder ? "itg" : null);

  const handleClose = useCallback(() => {
    setChosen(null);
    setDroppedFolder(null);
    onClose();
  }, [onClose, setDroppedFolder]);

  return (
    <Dialog
      isOpen={isOpen}
      title={t(
        source === "smx"
          ? "customData.smxTitle"
          : source === "itg"
            ? "customData.itgTitle"
            : "customData.chooseTitle",
      )}
      icon={<Import />}
      onClose={handleClose}
    >
      {isOpen && !source && <SourceChooser onChoose={setChosen} />}
      {isOpen && source === "smx" && <EditImportForm onClose={handleClose} />}
      {isOpen && source === "itg" && (
        <PackImportForm initialFolder={droppedFolder} onClose={handleClose} />
      )}
    </Dialog>
  );
}

/** Pick which kind of custom data to build. */
function SourceChooser({
  onChoose,
}: {
  onChoose: (this: void, source: ImportSource) => void;
}) {
  const { t } = useIntl();
  return (
    <DialogBody>
      <Menu large>
        <MenuItem
          icon={<Import />}
          text={t("customData.chooseSmx")}
          onClick={() => onChoose("smx")}
        />
        <MenuItem
          icon={<FolderOpen />}
          text={t("customData.chooseItg")}
          onClick={() => onChoose("itg")}
        />
      </Menu>
      <Text tagName="p">{t("customData.dropHint")}</Text>
    </DialogBody>
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
          kind: "smx",
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
      setError(convertErrorToString(e));
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
        <Text tagName="p">
          Pasted edit charts are merged into a copy of the stock StepManiaX
          data, published as a new custom data set, and added to the game data
          picker — the original stock SMX data is left untouched.
        </Text>
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
        {error && <PublishError error={error} />}
        <TurnstileSlot widgetKey={widgetKey} onToken={setToken} />
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

/** Where a publish is up to, for the progress readout. */
type PublishPhase = "resizing" | "uploading" | "loading";
interface PublishProgress {
  phase: PublishPhase;
  current?: number;
  total?: number;
}

/** The one image each song is drawn with, in the order the card falls back. */
function packJackets(pack: PackWithSongs): File[] {
  const files = new Set<File>();
  for (const song of pack.simfiles) {
    const { bg, banner, jacket } = song.title;
    const image = jacket || bg || banner;
    if (image) files.add(image);
  }
  return Array.from(files);
}

/**
 * Import a StepMania song pack from a local folder: parse it in-browser, resize
 * its art down to card size, then publish both the catalog and the images to
 * data.ddr.tools so the set is drawable — and identical for every synced peer,
 * unlike the session-local `blob:` urls this used to produce.
 */
function PackImportForm({
  initialFolder,
  onClose,
}: {
  initialFolder: DataTransferItem | null;
  onClose: (this: void) => void;
}) {
  const [folder, setFolder] = useState<DataTransferItem | null>(initialFolder);
  const [parsedPack, setParsedPack] = useState<PackWithSongs | null>(null);
  const [name, setName] = useState("");
  const [tiered, setTiered] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const folderInput = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const setLastConfigSelected = useSetLastConfigSelected();
  const { t } = useIntl();

  // Parse whichever folder we were handed, and seed the name/tier defaults from
  // what's in it.
  useEffect(() => {
    if (!folder) return;
    let ignore = false;
    setError(null);
    loadParserModule()
      .then(({ parsePack }) => parsePack(folder))
      .then((pack) => {
        if (ignore) return;
        setParsedPack(pack);
        setName(pack.name);
        setTiered(
          pack.simfiles.every((song) =>
            song.title.titleName.match(/^\[T\d\d\] /),
          ),
        );
      })
      .catch((rejection) => {
        if (ignore) return;
        console.error(rejection);
        setParsedPack(null);
        setError(convertErrorToString(rejection));
      });
    return () => {
      ignore = true;
    };
  }, [folder]);

  const chartCount = useMemo(
    () =>
      parsedPack?.simfiles.reduce(
        (total, song) => total + song.availableTypes.length,
        0,
      ) ?? 0,
    [parsedPack],
  );

  async function publish() {
    if (!parsedPack) return;
    setError(null);
    try {
      // Resize every image first. This is the slow part — pack art is full
      // resolution and there can be hundreds of files — so it reports progress
      // per image.
      const files = packJackets(parsedPack);
      setProgress({ phase: "resizing", current: 0, total: files.length });
      const resized = new Map<File, ResizedJacket>();
      for (const [i, file] of files.entries()) {
        resized.set(file, await resizeAndHashJacket(file));
        setProgress({ phase: "resizing", current: i + 1, total: files.length });
      }

      const data = getDataFileFromPack(parsedPack, tiered, (file) => {
        const jacket = resized.get(file);
        if (!jacket) {
          throw new Error(`no resized image for ${file.name}`);
        }
        return jacketUrlForHash(jacket.hash);
      });
      data.i18n.en.name = name.trim();

      // Collapse to unique images — a pack that reuses the same art across songs
      // only uploads it once.
      const uploads = new Map<string, Blob>();
      for (const { hash, blob } of resized.values()) {
        uploads.set(hash, blob);
      }

      setProgress({ phase: "uploading" });
      const { url } = await publishBundleWithJackets(
        data,
        uploads,
        {
          kind: "itg",
          packName: parsedPack.name,
          songCount: parsedPack.songCount,
          tiered,
          jacketCount: uploads.size,
        },
        token ?? undefined,
      );

      setProgress({ phase: "loading" });
      const loaded = await loadCustomGamedataByUrl(url);
      if (!loaded) {
        setError("Published, but the bundle didn't load back. Try again.");
        return;
      }
      const newConfig = await dispatch(
        createConfigFromInputs(name.trim(), url),
      );
      setLastConfigSelected(newConfig.id);
      toaster.show({
        intent: "success",
        icon: "import",
        message:
          `Published ${parsedPack.songCount} song${parsedPack.songCount === 1 ? "" : "s"} — ` +
          "opened a new config for it.",
      });
      onClose();
      navigate("config/" + newConfig.id);
    } catch (e) {
      setError(convertErrorToString(e));
      // The token may have been consumed server-side; remount for a fresh one so
      // a retry isn't rejected for reusing a single-use token.
      setToken(null);
      setWidgetKey((k) => k + 1);
    } finally {
      setProgress(null);
    }
  }

  if (progress) {
    return (
      <DialogBody>
        <PublishProgressReadout progress={progress} />
      </DialogBody>
    );
  }

  return (
    <>
      <DialogBody>
        <Text tagName="p">{t("customData.itgExplainer")}</Text>
        <input
          type="file"
          ref={folderInput}
          style={{ display: "none" }}
          // Non-standard, but it's how every browser exposes a folder picker.
          {...{ webkitdirectory: "", directory: "" }}
          multiple
          onChange={(e) =>
            setFolder(pickedFolderAsDropItem(e.currentTarget.files))
          }
        />
        {!parsedPack && !error && (
          <Button
            icon={<FolderOpen />}
            loading={!!folder}
            onClick={() => folderInput.current?.click()}
          >
            {t("customData.chooseFolder")}
          </Button>
        )}
        {parsedPack && (
          <>
            <FormGroup
              label="Data set name"
              helperText="Shown in the game data picker."
            >
              <InputGroup
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
            </FormGroup>
            <FormGroup>
              <Switch
                label={t("customData.usesTiers")}
                checked={tiered}
                onChange={() => setTiered((prev) => !prev)}
              />
            </FormGroup>
            <Text tagName="p">
              {`${parsedPack.songCount} song${parsedPack.songCount === 1 ? "" : "s"}, `}
              {`${chartCount} chart${chartCount === 1 ? "" : "s"}.`}
            </Text>
          </>
        )}
        {error && <PublishError error={error} />}
        <TurnstileSlot widgetKey={widgetKey} onToken={setToken} />
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button
              intent="primary"
              icon={<Import />}
              onClick={publish}
              disabled={
                !parsedPack || !name.trim() || (!!TURNSTILE_SITE_KEY && !token)
              }
            >
              Publish
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </>
        }
      />
    </>
  );
}

/**
 * Publishing a pack means resizing hundreds of images and uploading them — long
 * enough that a spinner alone leaves the user guessing.
 */
function PublishProgressReadout({ progress }: { progress: PublishProgress }) {
  const { t } = useIntl();
  const { phase, current, total } = progress;
  const determinate = phase === "resizing" && !!total;
  return (
    <>
      <Text tagName="p">
        {t(`customData.progress.${phase}`)}
        {determinate ? ` ${current} / ${total}` : null}
      </Text>
      <ProgressBar
        intent="primary"
        value={determinate ? (current ?? 0) / total : undefined}
      />
    </>
  );
}

function PublishError({ error }: { error: string }) {
  return (
    <Callout intent="danger" title="Something went wrong">
      <code style={{ whiteSpace: "pre-wrap" }}>{error}</code>
    </Callout>
  );
}

/*
 * No-op unless a site key is configured. With `interaction-only` appearance
 * Cloudflare renders nothing (0x0) for most visitors and only grows the widget
 * in when it actually needs a challenge from this session — no min-height/
 * min-width here, since reserving space up front would defeat that.
 * `maxWidth`/`maxHeight` are just a ceiling matching Cloudflare's documented
 * "normal" box (300x65), a backstop rather than a real limit.
 */
function TurnstileSlot({
  widgetKey,
  onToken,
}: {
  widgetKey: number;
  onToken: (token: string | null) => void;
}) {
  return (
    <div style={{ maxWidth: 300, maxHeight: 65, overflow: "hidden" }}>
      <TurnstileWidget key={widgetKey} onToken={onToken} />
    </div>
  );
}

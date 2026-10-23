import {
  Button,
  ButtonGroup,
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
import { Archive, Document, FolderOpen, Import } from "@blueprintjs/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import type { PackWithSongs } from "simfile-parser/browser";
import {
  buildEditDataFile,
  fetchEditCharts,
  parseEditCodes,
  type FetchEditsResult,
} from "./utils/smx-edit-import";
import { getDataFileFromPack, resolveJackets } from "./utils/itg-import";
import { jacketUrlForHash, resizeAndHashJacket } from "./utils/jacket-resize";
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
  pendingDrop,
  validateGameData,
} from "./state/game-data.atoms";
import { useAppDispatch } from "./state/store";
import { createConfigFromInputs } from "./state/thunks";
import { useSetLastConfigSelected } from "./state/config.atoms";
import { useIntl } from "./hooks/useIntl";
import type { GameData } from "./models/SongData";
import { toaster } from "./toaster";

type ImportSource = "smx" | "itg" | "json";

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
  const [dropped, setDropped] = useAtom(pendingDrop);
  // Dropping something says which importer is wanted, so it skips the chooser.
  const source =
    chosen ?? (dropped ? (dropped.kind === "json" ? "json" : "itg") : null);

  const handleClose = useCallback(() => {
    setChosen(null);
    setDropped(null);
    onClose();
  }, [onClose, setDropped]);

  return (
    <Dialog
      isOpen={isOpen}
      title={t(
        source === "smx"
          ? "customData.smxTitle"
          : source === "itg"
            ? "customData.itgTitle"
            : source === "json"
              ? "customData.jsonTitle"
              : "customData.chooseTitle",
      )}
      icon={<Import />}
      onClose={handleClose}
    >
      {isOpen && !source && <SourceChooser onChoose={setChosen} />}
      {isOpen && source === "smx" && <EditImportForm onClose={handleClose} />}
      {isOpen && source === "itg" && (
        <PackImportForm
          initialSource={dropped?.kind === "pack" ? dropped.item : null}
          onClose={handleClose}
        />
      )}
      {isOpen && source === "json" && (
        <JsonImportForm
          initialFile={dropped?.kind === "json" ? dropped.file : null}
          onClose={handleClose}
        />
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
        <MenuItem
          icon={<Document />}
          text={t("customData.chooseJson")}
          onClick={() => onChoose("json")}
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
  const { t } = useIntl();

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
      const created = t("customData.createdEdits", { count: result.matched });
      toaster.show({
        intent: result.unknownSongs.length ? "warning" : "success",
        icon: "import",
        message: result.unknownSongs.length
          ? `${created} ${t("customData.editsSkipped", { count: result.unknownSongs.length })}`
          : created,
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

/** A premade data file that's been read, parsed, and checked against the schema. */
type ParsedJsonFile =
  | { data: GameData; error: null }
  | { data: null; error: string };

async function readJsonFile(file: File): Promise<ParsedJsonFile> {
  try {
    const parsed: unknown = JSON.parse(await file.text());
    const problems = await validateGameData(parsed);
    if (problems.length) {
      return { data: null, error: problems.join("\n") };
    }
    return { data: parsed as GameData, error: null };
  } catch (e) {
    return { data: null, error: convertErrorToString(e) };
  }
}

/**
 * Publish a premade GameData `.json` file as-is: it's checked against the schema
 * it declares (see `validateGameData`) up front so a bad file fails here with a
 * readable reason, then published to data.ddr.tools like any other custom set
 * (which validates it again) so every synced peer resolves it to the same bytes.
 * Only the display name can change.
 */
function JsonImportForm({
  initialFile,
  onClose,
}: {
  initialFile: File | null;
  onClose: (this: void) => void;
}) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [parsed, setParsed] = useState<ParsedJsonFile | null>(null);
  const [name, setName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const setLastConfigSelected = useSetLastConfigSelected();
  const { t } = useIntl();

  useEffect(() => {
    if (!file) return;
    let ignore = false;
    setParsed(null);
    setError(null);
    void readJsonFile(file).then((result) => {
      if (ignore) return;
      setParsed(result);
      const fileName = file.name.replace(/\.json$/i, "");
      setName((result.data?.i18n.en?.name as string | undefined) || fileName);
    });
    return () => {
      ignore = true;
    };
  }, [file]);

  const data = parsed?.data;
  const chartCount =
    data?.songs.reduce((total, song) => total + song.charts.length, 0) ?? 0;

  async function publish() {
    if (!data || !file) return;
    setPublishing(true);
    setError(null);
    try {
      const named: GameData = {
        ...data,
        i18n: { ...data.i18n, en: { ...data.i18n.en, name: name.trim() } },
      };
      const { url } = await publishBundle(
        named,
        { kind: "json", fileName: file.name },
        token ?? undefined,
      );
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
        message: t("customData.createdJson", { count: data.songs.length }),
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
      setPublishing(false);
    }
  }

  return (
    <>
      <DialogBody>
        <Text tagName="p">{t("customData.jsonExplainer")}</Text>
        <input
          type="file"
          ref={fileInput}
          style={{ display: "none" }}
          accept=".json,application/json"
          onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
        />
        <FormGroup>
          <Button
            icon={<Document />}
            loading={!!file && !parsed}
            onClick={() => fileInput.current?.click()}
          >
            {file ? file.name : t("customData.chooseJsonFile")}
          </Button>
        </FormGroup>
        {data && (
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
            <Text tagName="p">
              {`${data.songs.length} song${data.songs.length === 1 ? "" : "s"}, `}
              {`${chartCount} chart${chartCount === 1 ? "" : "s"}.`}
            </Text>
          </>
        )}
        {parsed?.error && (
          <Callout intent="danger" title={t("customData.jsonInvalid")}>
            <code style={{ whiteSpace: "pre-wrap" }}>{parsed.error}</code>
          </Callout>
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
              loading={publishing}
              disabled={
                !data || !name.trim() || (!!TURNSTILE_SITE_KEY && !token)
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

/** Where a publish is up to, for the progress readout. */
type PublishPhase = "resizing" | "uploading" | "loading";
interface PublishProgress {
  phase: PublishPhase;
  current?: number;
  total?: number;
}

/**
 * Import an ITG song pack from a local folder or `.zip`: parse it in-browser, resize
 * its art down to card size, then publish both the catalog and the images to
 * data.ddr.tools so the set is drawable — and identical for every synced peer,
 * unlike the session-local `blob:` urls this used to produce.
 */
function PackImportForm({
  initialSource,
  onClose,
}: {
  initialSource: DataTransferItem | null;
  onClose: (this: void) => void;
}) {
  const [packSource, setPackSource] = useState<DataTransferItem | File | null>(
    initialSource,
  );
  const [parsedPack, setParsedPack] = useState<PackWithSongs | null>(null);
  const [name, setName] = useState("");
  const [tiered, setTiered] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const setLastConfigSelected = useSetLastConfigSelected();
  const { t } = useIntl();

  // Parse whichever folder or zip we were handed, and seed the name/tier defaults from
  // what's in it.
  useEffect(() => {
    if (!packSource) return;
    let ignore = false;
    setError(null);
    loadParserModule()
      .then(({ parsePack }) => parsePack(packSource))
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
  }, [packSource]);

  // Build the data set without art up front, so a pack that can't be read the
  // way the tier switch says shows that right away (and the user can flip it
  // back) instead of failing only once they publish.
  const preview = useMemo(() => {
    if (!parsedPack) return null;
    try {
      return { data: getDataFileFromPack(parsedPack, tiered), error: null };
    } catch (e) {
      console.error(e);
      return { data: null, error: convertErrorToString(e) };
    }
  }, [parsedPack, tiered]);
  const chartCount =
    preview?.data?.songs.reduce(
      (total, song) => total + song.charts.length,
      0,
    ) ?? 0;

  async function publish() {
    if (!parsedPack) return;
    setError(null);
    try {
      // Resize every image first. This is the slow part — pack art is full
      // resolution and there can be hundreds of files — so it reports progress
      // per song. Uploads collapse to unique images, so a pack that reuses the
      // same art across songs only sends it once.
      const uploads = new Map<string, Blob>();
      const total = parsedPack.simfiles.length;
      setProgress({ phase: "resizing", current: 0, total });
      const jackets = await resolveJackets(
        parsedPack,
        async (file) => {
          const { hash, blob } = await resizeAndHashJacket(file);
          uploads.set(hash, blob);
          return jacketUrlForHash(hash);
        },
        (current) => setProgress({ phase: "resizing", current, total }),
      );

      const data = getDataFileFromPack(parsedPack, tiered, jackets);
      data.i18n.en.name = name.trim();

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
        message: t("customData.createdPack", { count: parsedPack.songCount }),
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
            setPackSource(pickedFolderAsDropItem(e.currentTarget.files))
          }
        />
        <input
          type="file"
          ref={zipInput}
          style={{ display: "none" }}
          accept=".zip,application/zip"
          onChange={(e) => setPackSource(e.currentTarget.files?.[0] ?? null)}
        />
        {!parsedPack && !error && (
          <ButtonGroup>
            <Button
              icon={<FolderOpen />}
              loading={!!packSource}
              onClick={() => folderInput.current?.click()}
            >
              {t("customData.chooseFolder")}
            </Button>
            <Button
              icon={<Archive />}
              disabled={!!packSource}
              onClick={() => zipInput.current?.click()}
            >
              {t("customData.chooseZip")}
            </Button>
          </ButtonGroup>
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
            {preview?.data ? (
              <Text tagName="p">
                {`${parsedPack.songCount} song${parsedPack.songCount === 1 ? "" : "s"}, `}
                {`${chartCount} chart${chartCount === 1 ? "" : "s"}.`}
              </Text>
            ) : (
              <Callout
                intent="danger"
                title="Couldn't read tiers from this pack"
              >
                <code style={{ whiteSpace: "pre-wrap" }}>{preview?.error}</code>
              </Callout>
            )}
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
                !preview?.data ||
                !name.trim() ||
                (!!TURNSTILE_SITE_KEY && !token)
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

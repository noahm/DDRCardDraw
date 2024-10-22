import {
  Button,
  ButtonGroup,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  Drawer,
  DrawerSize,
  FormGroup,
  HTMLSelect,
  InputGroup,
  Intent,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  Position,
  Spinner,
  Tab,
  Tabs,
  TagInput,
  Tooltip,
} from "@blueprintjs/core";
import {
  NewLayers,
  Cog,
  Add,
  Duplicate,
  Trash,
  FloppyDisk,
  Import,
  Menu as MenuIcon,
} from "@blueprintjs/icons";
import { useState, lazy, Suspense, useRef } from "react";
import { FormattedMessage } from "react-intl";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../utils/error-fallback";
import {
  createConfigFromImport,
  createConfigFromInputs,
  createDraw,
} from "../state/thunks";
import { createAppSelector, useAppDispatch, useAppState } from "../state/store";
import { GauntletPicker, MatchPicker, PickedMatch } from "../matches";
import { StartggApiKeyGated } from "../startgg-gql/components";
import { configSlice, ConfigState } from "../state/config.slice";
import { GameDataSelect } from "../version-select";
import { loadConfig, saveConfig } from "../config-persistence";
import { SimpleMeta } from "../models/Drawing";

const ControlsDrawer = lazy(() => import("./controls-drawer"));

const getConfigSummaryValues = createAppSelector(
  [(s) => s.config.entities],
  (entities) =>
    Object.entries(entities).map(
      ([key, config]) =>
        [
          key,
          config.name,
          config.gameKey,
          config.lowerBound,
          config.upperBound,
        ] as const,
    ),
);

export function ConfigSelect(props: {
  selectedId: string | null;
  onChange(nextId: string): void;
  createDirection?: "left" | "right";
}) {
  const summaryValues = useAppState(getConfigSummaryValues);

  if (!summaryValues.length) {
    let emptyMsg = "no configs created";
    switch (props.createDirection) {
      case "left":
        emptyMsg = "👈 Create a config here";
        break;
      case "right":
        emptyMsg = "Create a config here 👉";
        break;
    }
    return (
      <HTMLSelect disabled value="placeholder">
        <option disabled value="placeholder">
          {emptyMsg}
        </option>
      </HTMLSelect>
    );
  }

  return (
    <HTMLSelect
      value={props.selectedId || undefined}
      onChange={(e) => props.onChange(e.currentTarget.value)}
    >
      <option disabled selected={!props.selectedId}>
        select a config
      </option>
      {summaryValues.map(([key, name, gameKey, lb, ub]) => (
        <option key={key} value={key}>
          {name} ({gameKey}, {lb}-{ub})
        </option>
      ))}
    </HTMLSelect>
  );
}

function CustomDrawForm(props: {
  initialMeta?: SimpleMeta;
  disableCreate?: boolean;
  onSubmit(meta: SimpleMeta): void;
}) {
  const [players, setPlayers] = useState<string[]>(
    props.initialMeta?.players || [],
  );
  const [title, setTitle] = useState<string>(props.initialMeta?.title || "");

  function handleSubmit() {
    props.onSubmit({
      type: "simple",
      players,
      title,
    });
  }
  return (
    <>
      <FormGroup label="title">
        <InputGroup
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </FormGroup>
      <FormGroup label="players">
        <TagInput
          onChange={(v) => setPlayers(v as string[])}
          values={players}
        />
      </FormGroup>
      <Button
        intent="primary"
        onClick={handleSubmit}
        disabled={props.disableCreate}
      >
        Create
      </Button>
    </>
  );
}

export function HeaderControls() {
  const [configId, setConfigId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastDrawFailed, setLastDrawFailed] = useState(false);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);
  const hasAnyConfig = useAppState((s) => !!s.config.ids.length);
  const isNarrow = useIsNarrow();
  const dispatch = useAppDispatch();

  function handleDraw(match: PickedMatch) {
    if (!configId) {
      return;
    }
    setMatchPickerOpen(false);
    const result = dispatch(
      createDraw(
        {
          meta: {
            type: "startgg",
            subtype: match.subtype,
            entrants: match.players,
            title: match.title,
            id: match.id,
          },
        },
        configId,
      ),
    );
    if (typeof result === "boolean") {
      setLastDrawFailed(result);
    } else {
      setLastDrawFailed(false);
    }
  }

  function openSettings() {
    setSettingsOpen((open) => !open);
    setLastDrawFailed(false);
  }

  return (
    <>
      <MultiControlsDrawer
        isNarrow={isNarrow}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <Dialog
        isOpen={matchPickerOpen}
        onClose={() => setMatchPickerOpen(false)}
        title="New Draw"
      >
        <DialogBody>
          <FormGroup label="Config">
            <ConfigSelect
              selectedId={configId}
              onChange={setConfigId}
              createDirection="right"
            />
          </FormGroup>
          <Tabs id="new-draw">
            <Tab
              id="startgg-versus"
              panel={
                <StartggApiKeyGated>
                  <MatchPicker onPickMatch={handleDraw} />
                </StartggApiKeyGated>
              }
            >
              start.gg (h2h)
            </Tab>
            <Tab
              id="startgg-group"
              panel={
                <StartggApiKeyGated>
                  <GauntletPicker onPickMatch={handleDraw} />
                </StartggApiKeyGated>
              }
            >
              start.gg (gauntlet)
            </Tab>
            <Tab
              id="custom"
              panel={
                <CustomDrawForm
                  disableCreate={!configId}
                  onSubmit={(meta) => dispatch(createDraw({ meta }, configId!))}
                />
              }
            >
              custom draw
            </Tab>
          </Tabs>
        </DialogBody>
      </Dialog>
      <ButtonGroup>
        <Tooltip
          isOpen={lastDrawFailed}
          content={<FormattedMessage id="controls.invalid" />}
          intent={Intent.DANGER}
          usePortal={false}
          position={Position.BOTTOM_RIGHT}
        >
          <Button
            onClick={() => setMatchPickerOpen(true)}
            icon={<NewLayers />}
            intent={Intent.PRIMARY}
            disabled={!hasAnyConfig}
          >
            <FormattedMessage id="draw" />
          </Button>
        </Tooltip>
        <Button
          icon={<Cog />}
          onClick={openSettings}
          data-umami-event="settings-open"
        />
      </ButtonGroup>
    </>
  );
}

function MultiControlsDrawer(props: {
  isOpen: boolean;
  isNarrow: boolean;
  onClose(): void;
}) {
  const [configId, setConfigId] = useState<string | null>(null);

  return (
    <Drawer
      isOpen={props.isOpen}
      position={Position.RIGHT}
      size={props.isNarrow ? DrawerSize.LARGE : "500px"}
      onClose={props.onClose}
      title={
        <>
          <FormattedMessage id="controls.drawerTitle" />
          <MultiControlsManager
            configId={configId}
            onConfigSelected={setConfigId}
          />
        </>
      }
    >
      <ErrorBoundary fallback={<ErrorFallback />}>
        <Suspense fallback={<Spinner style={{ marginTop: "2rem" }} />}>
          <ControlsDrawer configId={configId} />
        </Suspense>
      </ErrorBoundary>
    </Drawer>
  );
}

/**
 * provides UI for selecting/creating/cloning/import/exporting configs at the top of the config drawer
 */
function MultiControlsManager(props: {
  configId: string | null;
  onConfigSelected(configId: string): void;
}) {
  const selected = props.configId;
  const selectedName = useAppState((s) =>
    selected ? s.config.entities[selected].name : undefined,
  );
  const selectedGameId = useAppState((s) =>
    selected ? s.config.entities[selected].gameKey : undefined,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [busyCreating, setBusyCreating] = useState(false);
  const dispatch = useAppDispatch();
  const createBasisRef = useRef<string | ConfigState | undefined>();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busyCreating) return;

    const data = new FormData(e.currentTarget);
    const name = data.get("name") as string;
    const gameStub = data.get("game") as string;

    if (!name) {
      return;
    }
    if (!gameStub) {
      return;
    }

    setBusyCreating(true);
    const action =
      typeof createBasisRef.current === "object"
        ? createConfigFromImport(name, gameStub, createBasisRef.current)
        : createConfigFromInputs(name, gameStub, createBasisRef.current);
    const newConfig = await dispatch(action);
    setAddOpen(false);
    setBusyCreating(false);
    createBasisRef.current = undefined;
    props.onConfigSelected(newConfig.id);
  };

  function titleFromBasis() {
    switch (typeof createBasisRef.current) {
      case "object":
        return "Import config";
      case "string":
        return "Duplicate config";
      default:
        return "Create config";
    }
  }

  function defaultNameFromBasis() {
    switch (typeof createBasisRef.current) {
      case "object":
        return `copy of ${createBasisRef.current.name}`;
      case "string":
        return `copy of ${selectedName}`;
      default:
        return "";
    }
  }

  return (
    <>
      <Dialog
        isOpen={addOpen}
        onClose={() => {
          setAddOpen(false);
          createBasisRef.current = undefined;
        }}
        title={titleFromBasis()}
      >
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <FormGroup label="Name" inline>
              <input
                name="name"
                disabled={busyCreating}
                className={Classes.INPUT}
                defaultValue={defaultNameFromBasis()}
                autoComplete="off"
                data-1p-ignore
              />
            </FormGroup>
            <FormGroup label="Game" inline>
              <GameDataSelect name="game" defaultValue={selectedGameId} />
            </FormGroup>
          </DialogBody>
          <DialogFooter
            actions={
              <Button type="submit" loading={busyCreating}>
                Create
              </Button>
            }
          ></DialogFooter>
        </form>
      </Dialog>
      <Popover
        content={
          <Menu>
            <MenuItem
              text="Create new"
              icon={<Add />}
              onClick={() => setAddOpen(true)}
            />
            <MenuItem
              text="Duplicate"
              disabled={!selected}
              icon={<Duplicate />}
              onClick={() => {
                createBasisRef.current = selected || undefined;
                setAddOpen(true);
              }}
            />
            <MenuItem
              text="Delete"
              disabled={!selected}
              icon={<Trash />}
              onClick={() => dispatch(configSlice.actions.removeOne(selected!))}
            />
            <MenuDivider />
            <MenuItem
              text="Import from JSON"
              icon={<Import />}
              onClick={async () => {
                createBasisRef.current = await loadConfig();
                setAddOpen(true);
              }}
            />
            <MenuItem
              text="Save to JSON"
              disabled={!selected}
              icon={<FloppyDisk />}
              onClick={() =>
                saveConfig(dispatch((d, gs) => gs().config.entities[selected!]))
              }
            />
          </Menu>
        }
      >
        <Button style={{ marginInlineStart: "1em" }} icon={<MenuIcon />} />
      </Popover>
      <ConfigSelect
        selectedId={selected}
        onChange={props.onConfigSelected}
        createDirection="left"
      />
    </>
  );
}

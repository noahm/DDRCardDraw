import {
  Button,
  Classes,
  ControlGroup,
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
  NavbarDivider,
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
import { ShowChartsToggle } from "./show-charts-toggle";
import {
  createConfigFromImport,
  createConfigFromInputs,
  createDraw,
} from "../state/thunks";
import { createAppSelector, useAppDispatch, useAppState } from "../state/store";
import { useSetAtom } from "jotai";
import { showEligibleCharts } from "../config-state";
import { MatchPicker, PickedMatch } from "../matches";
import { StartggApiKeyGated } from "../startgg-gql/components";
import { configSlice, ConfigState } from "../state/config.slice";
import { GameDataSelect } from "../version-select";
import { loadConfig, saveConfig } from "../config-persistence";
import { SimpleMeta } from "../models/Drawing";

const ControlsDrawer = lazy(() => import("./controls-drawer"));

const getConfigEntries = createAppSelector(
  [(s) => s.config.entities],
  (entities) =>
    Object.entries(entities).map(([key, config]) => [key, config.name]),
);

function ConfigSelect() {
  const configEntries = useAppState(getConfigEntries);
  const current = useAppState((s) => s.config.current);
  const dispatch = useAppDispatch();

  if (!configEntries.length) {
    return (
      <HTMLSelect disabled value="placeholder">
        <option disabled value="placeholder">
          Create a draw config
        </option>
      </HTMLSelect>
    );
  }

  return (
    <HTMLSelect
      value={current || undefined}
      onChange={(e) =>
        dispatch(configSlice.actions.pickCurrent(e.currentTarget.value))
      }
    >
      {configEntries.map(([key, name]) => (
        <option key={key} value={key}>
          {name}
        </option>
      ))}
    </HTMLSelect>
  );
}

function CustomDrawForm(props: {
  initialMeta?: SimpleMeta;
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
      <Button intent="primary" onClick={handleSubmit}>
        Create
      </Button>
    </>
  );
}

export function HeaderControls() {
  const setShowEligibleCharts = useSetAtom(showEligibleCharts);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastDrawFailed, setLastDrawFailed] = useState(false);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);
  const hasConfig = useAppState((s) => !!s.config.current);
  const isNarrow = useIsNarrow();
  const dispatch = useAppDispatch();

  function handleDraw(match: PickedMatch) {
    setMatchPickerOpen(false);
    setShowEligibleCharts(false);
    const result = dispatch(
      createDraw({
        meta: {
          type: "startgg",
          entrants: match.players,
          title: match.title,
          id: match.id,
        },
      }),
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
      <Drawer
        isOpen={settingsOpen}
        position={Position.RIGHT}
        size={isNarrow ? DrawerSize.LARGE : "500px"}
        onClose={() => setSettingsOpen(false)}
        title={
          <>
            <FormattedMessage id="controls.drawerTitle" />
            <ControlsList />
          </>
        }
      >
        <ErrorBoundary fallback={<ErrorFallback />}>
          <Suspense fallback={<Spinner style={{ marginTop: "2rem" }} />}>
            <ControlsDrawer />
          </Suspense>
        </ErrorBoundary>
      </Drawer>
      <Dialog
        isOpen={matchPickerOpen}
        onClose={() => setMatchPickerOpen(false)}
        title="New Draw"
      >
        <DialogBody>
          <Tabs id="new-draw">
            <Tab
              id="drawings"
              panel={
                <StartggApiKeyGated>
                  <MatchPicker onPickMatch={handleDraw} />
                </StartggApiKeyGated>
              }
            >
              start.gg match
            </Tab>
            <Tab
              id="players"
              panel={
                <CustomDrawForm
                  onSubmit={(meta) => dispatch(createDraw({ meta }))}
                />
              }
            >
              custom draw
            </Tab>
          </Tabs>
        </DialogBody>
      </Dialog>
      {!isNarrow && (
        <>
          <ShowChartsToggle inDrawer={false} />
          <NavbarDivider />
        </>
      )}
      <ControlGroup>
        <ConfigSelect />
        <Tooltip
          isOpen={lastDrawFailed}
          content={<FormattedMessage id="controls.invalid" />}
          intent={Intent.DANGER}
          usePortal={false}
          position={Position.BOTTOM_RIGHT}
        >
          <Button
            icon={<Cog />}
            onClick={openSettings}
            data-umami-event="settings-open"
          />
        </Tooltip>
      </ControlGroup>
      <NavbarDivider />
      <Tooltip disabled={hasConfig} content="Select a config first">
        <Button
          onClick={() => setMatchPickerOpen(true)}
          icon={<NewLayers />}
          intent={Intent.PRIMARY}
          disabled={!hasConfig}
        >
          <FormattedMessage id="draw" />
        </Button>
      </Tooltip>
    </>
  );
}

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

function ControlsList() {
  const summaryValues = useAppState(getConfigSummaryValues);
  const selected = useAppState((s) => s.config.current);
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
    await dispatch(action);
    setAddOpen(false);
    setBusyCreating(false);
    createBasisRef.current = undefined;
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
                saveConfig(
                  dispatch(
                    (d, gs) => gs().config.entities[gs().config.current!],
                  ),
                )
              }
            />
          </Menu>
        }
      >
        <Button style={{ marginInlineStart: "1em" }} icon={<MenuIcon />} />
      </Popover>
      <HTMLSelect
        value={selected || "create"}
        onChange={(e) =>
          dispatch(configSlice.actions.pickCurrent(e.currentTarget.value))
        }
        disabled={!summaryValues.length}
      >
        {summaryValues.length ? (
          summaryValues.map(([key, name, gameKey, lb, ub]) => (
            <option key={key} value={key}>
              {name} ({gameKey}, {lb}-{ub})
            </option>
          ))
        ) : (
          <option disabled value="create">
            👈 Create a config here
          </option>
        )}
      </HTMLSelect>
    </>
  );
}

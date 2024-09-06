import {
  Button,
  ControlGroup,
  Dialog,
  DialogBody,
  Drawer,
  DrawerSize,
  HTMLSelect,
  Intent,
  NavbarDivider,
  Position,
  Spinner,
  Tooltip,
} from "@blueprintjs/core";
import { NewLayers, Cog } from "@blueprintjs/icons";
import { useState, lazy, Suspense } from "react";
import { FormattedMessage } from "react-intl";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../utils/error-fallback";
import { ShowChartsToggle } from "./show-charts-toggle";
import { createDraw } from "../state/thunks";
import { createAppSelector, useAppDispatch, useAppState } from "../state/store";
import { useSetAtom } from "jotai";
import { showEligibleCharts } from "../config-state";
import { MatchPicker, PickedMatch } from "../matches";
import { StartggApiKeyGated } from "../startgg-gql/components";
import { configSlice } from "../state/config.slice";

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

export function HeaderControls() {
  const setShowEligibleCharts = useSetAtom(showEligibleCharts);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastDrawFailed, setLastDrawFailed] = useState(false);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);
  const hasConfig = useAppState((s) => !!s.config.current);
  const isNarrow = useIsNarrow();
  const dispatch = useAppDispatch();

  function handleDraw(match?: PickedMatch) {
    setMatchPickerOpen(false);
    setShowEligibleCharts(false);
    const result = dispatch(
      createDraw({
        meta: match
          ? {
              type: "startgg",
              entrants: match.players,
              title: match.title,
              id: match.id,
            }
          : {
              type: "simple",
              title: "",
              players: ["", ""],
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
            {/* <ButtonGroup style={{ marginLeft: "10px" }}>
              <Button icon={<FloppyDisk />} onClick={saveConfig}>
                Save
              </Button>
              <Button icon={<Import />} onClick={loadConfig}>
                Load
              </Button>
            </ButtonGroup> */}
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
          <p>
            Pick a startgg match or{" "}
            <Button minimal onClick={() => handleDraw()}>
              draw without a match
            </Button>
          </p>
          <StartggApiKeyGated>
            <MatchPicker onPickMatch={handleDraw} />
          </StartggApiKeyGated>
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

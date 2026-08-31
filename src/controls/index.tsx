import {
  Button,
  ButtonGroup,
  Drawer,
  DrawerSize,
  Intent,
  NavbarDivider,
  Position,
  Spinner,
  Tooltip,
} from "@blueprintjs/core";
import { NewLayers, Cog, FloppyDisk, Import } from "@blueprintjs/icons";
import { useState, lazy, Suspense } from "react";
import { FormattedMessage } from "react-intl";
import { useConfigState } from "../config-state";
import { useDrawState } from "../draw-state";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { loadConfig, saveConfig } from "../config-persistence";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../utils/error-fallback";
import { ShowChartsToggle } from "./show-charts-toggle";

const ControlsDrawer = lazy(() => import("./controls-drawer"));

export function HeaderControls() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastDrawFailed, setLastDrawFailed] = useState(false);
  const [drawSongs, hasGameData] = useDrawState((s) => [
    s.drawSongs,
    !!s.gameData,
  ]);
  const isNarrow = useIsNarrow();

  function handleDraw() {
    useConfigState.setState({ showEligibleCharts: false });
    drawSongs(useConfigState.getState());
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
            <ButtonGroup style={{ marginLeft: "10px" }}>
              <Button icon={<FloppyDisk />} onClick={saveConfig}>
                <FormattedMessage id="controls.save" defaultMessage="Save" />
              </Button>
              <Button icon={<Import />} onClick={loadConfig}>
                <FormattedMessage id="controls.load" defaultMessage="Load" />
              </Button>
            </ButtonGroup>
          </>
        }
      >
        <ErrorBoundary fallback={<ErrorFallback />}>
          <Suspense fallback={<Spinner style={{ marginTop: "2rem" }} />}>
            <ControlsDrawer />
          </Suspense>
        </ErrorBoundary>
      </Drawer>
      {!isNarrow && (
        <>
          <ShowChartsToggle inDrawer={false} />
          <NavbarDivider />
        </>
      )}
      <ButtonGroup>
        <Tooltip disabled={hasGameData} content="Loading game data">
          <Button
            onClick={handleDraw}
            icon={<NewLayers />}
            intent={Intent.PRIMARY}
            disabled={!hasGameData}
          >
            <FormattedMessage id="draw" />
          </Button>
        </Tooltip>
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
      </ButtonGroup>
    </>
  );
}

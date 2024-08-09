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
import { NewLayers, Cog } from "@blueprintjs/icons";
import { useState, lazy, Suspense } from "react";
import { FormattedMessage } from "react-intl";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../utils/error-fallback";
import { ShowChartsToggle } from "./show-charts-toggle";
import { createDraw } from "../state/thunks";
import { useAppDispatch } from "../state/store";
import { useAtomValue, useSetAtom } from "jotai";
import { showEligibleCharts } from "../config-state";
import { gameDataLoadingStatus } from "../state/game-data.atoms";

const ControlsDrawer = lazy(() => import("./controls-drawer"));

export function HeaderControls() {
  const setShowEligibleCharts = useSetAtom(showEligibleCharts);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastDrawFailed, setLastDrawFailed] = useState(false);
  const hasGameData = useAtomValue(gameDataLoadingStatus) === "available";
  const isNarrow = useIsNarrow();
  const dispatch = useAppDispatch();

  function handleDraw() {
    setShowEligibleCharts(false);
    const result = dispatch(
      createDraw({
        players: ["TEMP1", "TEMP2"],
        title: "TEMP TITLE",
        startggSetId: "PLACEHOLDER",
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

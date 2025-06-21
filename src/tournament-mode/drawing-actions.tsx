import {
  Button,
  Dialog,
  DialogBody,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
} from "@blueprintjs/core";
import {
  Camera,
  CubeAdd,
  Edit,
  Error,
  Exchange,
  FloppyDisk,
  Label,
  NewLayer,
  NewLayers,
  Refresh,
  Th,
  Trash,
} from "@blueprintjs/icons";
import { useAtomValue } from "jotai";
import { domToPng } from "modern-screenshot";
import { useState, lazy } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { showPlayerAndRoundLabels } from "../config-state";
import { useDrawing } from "../drawing-context";
import {
  CompoundSetId,
  playerCount,
  StartggGauntletMeta,
} from "../models/Drawing";
import {
  BracketSetGameDataInput as GDI,
  ReportSetMutationVariables as MutationVariables,
  useReportSetMutation,
} from "../startgg-gql";
import {
  drawingsSlice,
  getDrawingFromCompoundId,
} from "../state/drawings.slice";
import { eventSlice } from "../state/event.slice";
import { AppThunk, useAppDispatch, useAppState } from "../state/store";
import {
  createPlusOneChart,
  createRedrawAll,
  createSubdraw,
} from "../state/thunks";
import { CountingSet } from "../utils/counting-set";
import { shareImage } from "../utils/share";
import styles from "./drawing-actions.css";
import { EventModeGated } from "../common-components/app-mode";
import { useIntl } from "../hooks/useIntl";
import { useConfigId } from "../state/hooks";
import { CustomDrawForm } from "../controls/draw-dialog";
import { times } from "../utils";

const GauntletEditor = lazy(() => import("./gauntlet-scores"));

/** thunk that dispatches nothing, but calculates the result to be sent to startgg */
function getMatchResult(
  drawingId: CompoundSetId,
): AppThunk<MutationVariables | undefined> {
  return (_, getState): MutationVariables | undefined => {
    const s = getState();
    const gameData: Array<GDI> = [];
    const [parent] = getDrawingFromCompoundId(s.drawings, drawingId);
    if (parent.meta.type !== "startgg") {
      return;
    }
    const winsPerPlayer = new CountingSet<string>();
    for (const [songId, pIdx] of Object.entries(parent.winners)) {
      if (pIdx === null) {
        continue;
      }
      try {
        const entrant = parent.meta.entrants[pIdx];
        gameData.push({
          gameNum: gameData.length + 1,
          winnerId: entrant.id,
        });
        winsPerPlayer.add(entrant.id);
      } catch (e) {
        console.warn(`failed to add game data for song ${songId}`, e);
      }
    }
    let winnerId: string | undefined;
    const orderedByWins = Array.from(winsPerPlayer.valuesWithCount()).sort(
      (a, b) => b[1] - a[1],
    );
    if (
      orderedByWins.length == 1 ||
      orderedByWins[0][1] > orderedByWins[1][1]
    ) {
      // confirmed no tie for first place
      winnerId = orderedByWins[0][0];
    }
    const ret: MutationVariables = {
      setId: parent.meta.id,
      winnerId,
    };
    if (gameData.length) {
      ret.gameData = gameData;
    }
    return ret;
  };
}

const DEFAULT_FILENAME = "card-draw.png";

function SaveToStartggButton() {
  const dispatch = useAppDispatch();
  const drawingId = useDrawing((s) => s.compoundId);
  const drawingMeta = useDrawing((s) => s.meta);
  const [mutationData, reportSet] = useReportSetMutation();
  if (drawingMeta.type !== "startgg" || drawingMeta.subtype !== "versus") {
    return null;
  }

  let tooltipContent = "Save Winner to Start.gg";
  if (mutationData.error) {
    tooltipContent = `Error saving: ${mutationData.error.message}`;
  }
  if (mutationData.fetching) {
    tooltipContent = "Saving...";
  }

  return (
    <Tooltip
      intent={mutationData.error ? "danger" : "none"}
      content={tooltipContent}
    >
      <Button
        variant="minimal"
        disabled={mutationData.fetching}
        icon={<FloppyDisk />}
        onClick={() => {
          const results = dispatch(getMatchResult(drawingId));
          if (!results) {
            return;
          }
          reportSet(results);
        }}
      />
    </Tooltip>
  );
}

function EditDrawMenu() {
  const dispatch = useAppDispatch();
  const { t } = useIntl();
  const [metaEditorOpen, setMetaEditorOpen] = useState(false);
  const drawingId = useDrawing((s) => s.compoundId);
  const drawingMeta = useDrawing((s) => s.meta);
  const isTwoPlayers = playerCount(drawingMeta) === 2;
  const showLabels = useAtomValue(showPlayerAndRoundLabels);

  let dialogBody: JSX.Element | null;
  switch (drawingMeta.type) {
    case "simple":
      dialogBody = (
        <CustomDrawForm
          initialMeta={drawingMeta}
          submitText="Save"
          onSubmit={(meta) => {
            const [mainId] = drawingId;
            dispatch(
              drawingsSlice.actions.updateOne({
                id: mainId,
                changes: {
                  meta,
                  playerDisplayOrder: times(meta.players.length, (n) => n - 1),
                },
              }),
            );
            setMetaEditorOpen(false);
          }}
        />
      );
      break;
    case "startgg":
      dialogBody = null;
  }
  return (
    <>
      <Dialog
        isOpen={metaEditorOpen}
        title="Edit Match"
        onClose={() => setMetaEditorOpen(false)}
      >
        <DialogBody>{dialogBody}</DialogBody>
      </Dialog>
      <Tooltip content="Update Draw">
        <Popover
          content={
            <Menu>
              <MenuItem
                icon={<Label />}
                text="Edit Title & Players"
                onClick={() => setMetaEditorOpen(true)}
              />
              <MenuItem
                icon={<NewLayer />}
                text="Draw Another Chart"
                onClick={() => dispatch(createPlusOneChart(drawingId))}
              />
              <MenuItem icon={<NewLayers />} text="Draw Extra Set">
                <ConfigsAsMenuItems />
              </MenuItem>
              {showLabels && isTwoPlayers && (
                <MenuItem
                  text="Swap Player Positions"
                  icon={<Exchange />}
                  onClick={() => {
                    dispatch(
                      drawingsSlice.actions.swapPlayerPositions(drawingId),
                    );
                  }}
                />
              )}
              <MenuItem
                text={t("drawing.redrawAll", undefined, "Redraw all charts")}
                icon={<Refresh />}
                onClick={() =>
                  confirm(
                    t(
                      "drawing.redrawConfirm",
                      undefined,
                      "This will replace everything besides protects and picks!",
                    ),
                  ) && dispatch(createRedrawAll(drawingId))
                }
              />
              <MenuItem
                text="Delete this draw"
                icon={<Trash />}
                onClick={() =>
                  confirm(
                    "This draw will be permanently removed and cannot be recovered!",
                  ) && dispatch(drawingsSlice.actions.removeOne(drawingId))
                }
              />
            </Menu>
          }
        >
          <Button variant="minimal" icon={<Edit />} />
        </Popover>
      </Tooltip>
    </>
  );
}

function ConfigsAsMenuItems() {
  const configs = useAppState((s) => s.config.ids);
  return (
    <>
      {configs.map((cid) => (
        <ConfigAsMenuItem key={cid} configId={cid} />
      ))}
    </>
  );
}

function ConfigAsMenuItem(props: { configId: string }) {
  const config = useAppState((s) => s.config.entities[props.configId]);
  const dispatch = useAppDispatch();
  const currentConfigId = useConfigId();
  const [drawingId] = useDrawing((d) => d.compoundId);
  return (
    <MenuItem
      intent={currentConfigId === props.configId ? "primary" : undefined}
      text={`${config.name} (${config.chartCount}@${config.lowerBound}-${config.upperBound})`}
      onClick={() => dispatch(createSubdraw(drawingId, props.configId))}
    />
  );
}

export function DrawingActions() {
  const dispatch = useAppDispatch();
  const { t } = useIntl();
  const cabs = useAppState(eventSlice.selectors.allCabs);
  const drawingId = useDrawing((s) => s.compoundId);
  const drawingMeta = useDrawing((s) => s.meta);
  const isGauntlet =
    drawingMeta.type === "startgg" && drawingMeta.subtype === "gauntlet";
  const { showBoundary } = useErrorBoundary();
  const [gauntletEditorMeta, setGauntletEditorMeta] = useState<
    StartggGauntletMeta | undefined
  >(undefined);

  const addToCabMenu = (
    <Menu>
      {cabs.map((cab) => (
        <MenuItem
          key={cab.id}
          text={cab.name}
          onClick={() =>
            dispatch(
              eventSlice.actions.assignMatchToCab({
                cabId: cab.id,
                matchId: drawingId,
              }),
            )
          }
        />
      ))}
    </Menu>
  );

  return (
    <div className={styles.networkButtons}>
      <Tooltip content={t("drawing.saveImage", undefined, "Save image")}>
        <Button
          variant="minimal"
          icon={<Camera />}
          onClick={async () => {
            const drawingElement = document.querySelector(
              "#drawing-" + drawingId,
            );
            if (drawingElement) {
              shareImage(
                await domToPng(drawingElement, {
                  scale: 2,
                }),
                DEFAULT_FILENAME,
              );
            }
          }}
        />
      </Tooltip>
      {process.env.NODE_ENV === "production" ? null : (
        <Tooltip content="Cause Error">
          <Button variant="minimal" icon={<Error />} onClick={showBoundary} />
        </Tooltip>
      )}
      <EventModeGated>
        {!!cabs.length && (
          <Tooltip content="Assign to Cab">
            <Popover content={addToCabMenu} placement="bottom">
              <Button variant="minimal" icon={<CubeAdd />} />
            </Popover>
          </Tooltip>
        )}
      </EventModeGated>
      {isGauntlet && (
        <>
          <Tooltip content="Edit Gauntlet Scores">
            <Button
              variant="minimal"
              icon={<Th />}
              onClick={() => {
                setGauntletEditorMeta(drawingMeta);
              }}
            />
          </Tooltip>
          <Dialog
            onClose={() => setGauntletEditorMeta(undefined)}
            isOpen={!!gauntletEditorMeta}
            title="Gauntlet Scores Editor"
            style={{ width: "auto" }}
          >
            <DialogBody>
              <GauntletEditor meta={gauntletEditorMeta!} />
            </DialogBody>
          </Dialog>
        </>
      )}
      <EventModeGated>
        <SaveToStartggButton />
      </EventModeGated>
      <EditDrawMenu />
    </div>
  );
}

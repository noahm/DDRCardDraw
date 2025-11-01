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
  DataLineage,
  DocumentShare,
  Edit,
  Error,
  Exchange,
  FloppyDisk,
  Label,
  NewLayer,
  NewLayers,
  Refresh,
  SendTo,
  Th,
  Trash,
} from "@blueprintjs/icons";
import { useAtomValue } from "jotai";
import { domToPng } from "modern-screenshot";
import { useState, lazy, JSX } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { showPlayerAndRoundLabels } from "../config-state";
import { useDrawing } from "../drawing-context";
import {
  CHART_DRAWN,
  CHART_PLACEHOLDER,
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
import {
  AppThunk,
  useAppDispatch,
  useAppState,
  useAppStore,
} from "../state/store";
import {
  createPlusOneChart,
  createRedrawAll,
  createSubdraw,
} from "../state/thunks";
import { CountingSet } from "../utils/counting-set";
import { shareCharts, shareImage } from "../utils/share";
import styles from "./drawing-actions.css";
import { EventModeGated } from "../common-components/app-mode";
import { useIntl } from "../hooks/useIntl";
import { ConfigContextProvider, useConfigId } from "../state/hooks";
import { CustomDrawForm } from "../controls/draw-dialog";
import { times } from "../utils";
import { mergeDraws } from "../state/central";

const GauntletEditor = lazy(() => import("./gauntlet-scores"));

/** thunk that dispatches nothing, but calculates the result to be sent to startgg */
function getMatchResult(
  drawingId: string,
): AppThunk<MutationVariables | undefined> {
  return (_, getState): MutationVariables | undefined => {
    const s = getState();
    const gameData: Array<GDI> = [];
    const parent = s.drawings.entities[drawingId];
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
        gameData.push({ gameNum: gameData.length + 1, winnerId: entrant.id });
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
    const ret: MutationVariables = { setId: parent.meta.id, winnerId };
    if (gameData.length) {
      ret.gameData = gameData;
    }
    return ret;
  };
}

const DEFAULT_FILENAME = "card-draw.png";

function SaveToStartggButton({ drawingId }: { drawingId: string }) {
  const dispatch = useAppDispatch();
  const drawingMeta = useAppState((s) => s.drawings.entities[drawingId].meta);
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

function EditSetMenu() {
  const dispatch = useAppDispatch();
  const { t } = useIntl();
  const drawingId = useDrawing((s) => s.compoundId);

  return (
    <>
      <Tooltip content="Alter Set">
        <Popover
          content={
            <Menu>
              <MenuItem
                icon={<NewLayer />}
                text="Draw Another Chart"
                onClick={() =>
                  dispatch(createPlusOneChart(drawingId, CHART_DRAWN))
                }
              />
              <MenuItem
                icon={<Edit />}
                text="Add New Player Pick"
                onClick={() =>
                  dispatch(createPlusOneChart(drawingId, CHART_PLACEHOLDER))
                }
              />
              <MenuItem
                text={t("drawing.redrawAll", undefined, "Redraw set")}
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
                text="Delete this set"
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

function ConfigsAsMenuItems({ drawingId }: { drawingId: string }) {
  const configs = useAppState((s) => s.config.ids);
  return (
    <>
      {configs.map((cid) => (
        <ConfigAsMenuItem key={cid} configId={cid} drawingId={drawingId} />
      ))}
    </>
  );
}

function ConfigAsMenuItem(props: { configId: string; drawingId: string }) {
  const config = useAppState((s) => s.config.entities[props.configId]);
  const dispatch = useAppDispatch();
  const currentConfigId = useConfigId();
  return (
    <MenuItem
      intent={currentConfigId === props.configId ? "primary" : undefined}
      text={`${config.name} (${config.chartCount}@${config.lowerBound}-${config.upperBound})`}
      onClick={() => dispatch(createSubdraw(props.drawingId, props.configId))}
    />
  );
}

export function DrawingActions() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
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
              eventSlice.actions.assignSetToCab({
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
              "#drawing-" + drawingId[1],
            );
            if (drawingElement) {
              shareImage(
                await domToPng(drawingElement, { scale: 2 }),
                DEFAULT_FILENAME,
              );
            }
          }}
        />
      </Tooltip>
      <Tooltip content={t("drawing.copyCards", undefined, "Save as CSV")}>
        <Button
          variant="minimal"
          icon={<FloppyDisk />}
          onClick={() =>
            shareCharts(
              getDrawingFromCompoundId(
                store.getState().drawings,
                drawingId,
              )[1].charts.filter((c) => c.type === "DRAWN"),
              "drawn",
            )
          }
        />
      </Tooltip>
      {process.env.NODE_ENV === "production" ? null : (
        <Tooltip content="Cause Error">
          <Button variant="minimal" icon={<Error />} onClick={showBoundary} />
        </Tooltip>
      )}
      <EventModeGated>
        {!!cabs.length && (
          <Tooltip content="Assign Set to Cab">
            <Popover content={addToCabMenu} placement="bottom">
              <Button variant="minimal" icon={<SendTo />} />
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
      <EditSetMenu />
    </div>
  );
}

export function MatchActions({ drawingId }: { drawingId: string }) {
  const dispatch = useAppDispatch();
  const cabs = useAppState(eventSlice.selectors.allCabs);

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
      <EventModeGated>
        {!!cabs.length && (
          <Tooltip content="Assign Match to Cab">
            <Popover content={addToCabMenu} placement="bottom">
              <Button variant="minimal" icon={<DocumentShare />} />
            </Popover>
          </Tooltip>
        )}
      </EventModeGated>
      <EventModeGated>
        <SaveToStartggButton drawingId={drawingId} />
      </EventModeGated>
      <EditMatchMenu drawingId={drawingId} />
    </div>
  );
}

function EditMatchMenu({ drawingId }: { drawingId: string }) {
  const dispatch = useAppDispatch();
  const [metaEditorOpen, setMetaEditorOpen] = useState(false);
  const drawingMeta = useAppState((s) => s.drawings.entities[drawingId].meta);
  const configId = useAppState((s) => s.drawings.entities[drawingId].configId);
  const isTwoPlayers = playerCount(drawingMeta) === 2;
  const showLabels = useAtomValue(showPlayerAndRoundLabels);

  let editPlayersDialog: JSX.Element | null;
  switch (drawingMeta.type) {
    case "simple":
      editPlayersDialog = (
        <CustomDrawForm
          initialMeta={drawingMeta}
          submitText="Save"
          onSubmit={(meta) => {
            dispatch(
              drawingsSlice.actions.updateOne({
                id: drawingId,
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
      // @todo figure out what edit looks like for startgg?
      editPlayersDialog = null;
  }

  const menu = (
    <Menu>
      {editPlayersDialog && (
        <MenuItem
          icon={<Label />}
          text="Edit Title & Players"
          onClick={() => setMetaEditorOpen(true)}
        />
      )}
      <MenuItem icon={<NewLayers />} text="Draw Extra Set">
        <ConfigContextProvider value={configId}>
          <ConfigsAsMenuItems drawingId={drawingId} />
        </ConfigContextProvider>
      </MenuItem>
      <MenuItem
        icon={<DataLineage />}
        text="Merge All Sets"
        onClick={() => dispatch(mergeDraws({ drawingId }))}
      />
      {showLabels && isTwoPlayers && (
        <MenuItem
          text="Swap Player Positions"
          icon={<Exchange />}
          onClick={() => {
            dispatch(drawingsSlice.actions.swapPlayerPositions(drawingId));
          }}
        />
      )}
      <MenuItem
        text="Delete this match"
        icon={<Trash />}
        onClick={() =>
          confirm(
            "This match will be permanently removed and cannot be recovered!",
          ) && dispatch(drawingsSlice.actions.removeOne([drawingId, ""]))
        }
      />
    </Menu>
  );

  return (
    <>
      <Dialog
        isOpen={metaEditorOpen}
        title="Edit Match"
        onClose={() => setMetaEditorOpen(false)}
      >
        <DialogBody>{editPlayersDialog}</DialogBody>
      </Dialog>
      <Tooltip content="Alter Match">
        <Popover content={menu}>
          <Button variant="minimal" icon={<Edit />} />
        </Popover>
      </Tooltip>
    </>
  );
}

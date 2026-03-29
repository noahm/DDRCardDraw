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
  Random,
  Edit,
  Error as ErrorIcon,
  Exchange,
  Label,
  NewLayer,
  NewLayers,
  Refresh,
  SendTo,
  TableSync,
  Th,
  ThVirtual,
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
  type Drawing,
} from "../models/Drawing";
import {
  BracketSetGameDataInput as GDI,
  ReportSetMutationVariables as MutationVariables,
  useReportSetMutation,
} from "../startgg-gql";
import { CountingSet } from "../utils/counting-set";
import { shareCharts, shareImage } from "../utils/share";
import styles from "./drawing-actions.css";
import { EventModeGated } from "../common-components/app-mode";
import { useIntl } from "../hooks/useIntl";
import { ConfigContextProvider, useConfigId } from "../state/hooks";
import { CustomDrawForm } from "../controls/draw-dialog";
import { times } from "../utils";
import { useHighlightRandom } from "./highlight-random";
import { useRoomState } from "../jazz/app-state-context";
import { useMutations } from "../jazz/use-mutations";

const GauntletEditor = lazy(() => import("./gauntlet-scores"));

/** Pure function that calculates the result to be sent to start.gg */
function getMatchResult(drawing: Drawing): MutationVariables | undefined {
  if (drawing.meta.type !== "startgg") {
    return undefined;
  }
  const gameData: Array<GDI> = [];
  const winsPerPlayer = new CountingSet<string>();
  for (const [songId, pIdx] of Object.entries(drawing.winners)) {
    if (pIdx === null) {
      continue;
    }
    try {
      const entrant = drawing.meta.entrants[pIdx];
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
  const ret: MutationVariables = { setId: drawing.meta.id, winnerId };
  if (gameData.length) {
    ret.gameData = gameData;
  }
  return ret;
}

const DEFAULT_FILENAME = "card-draw.png";

function SaveToStartggButton({ drawingId }: { drawingId: string }) {
  const drawing = useRoomState((s) => s.drawings.entities[drawingId]);
  const [mutationData, reportSet] = useReportSetMutation();
  if (!drawing || drawing.meta.type !== "startgg" || drawing.meta.subtype !== "versus") {
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
        icon={<TableSync />}
        onClick={() => {
          const results = getMatchResult(drawing);
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
  const mutations = useMutations();
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
                  mutations.plusOneChart(drawingId, CHART_DRAWN)
                }
              />
              <MenuItem
                icon={<Edit />}
                text="Add New Player Pick"
                onClick={() =>
                  mutations.plusOneChart(drawingId, CHART_PLACEHOLDER)
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
                  ) && mutations.redrawAll(drawingId)
                }
              />
              <MenuItem
                text="Delete this set"
                icon={<Trash />}
                onClick={() =>
                  confirm(
                    "This draw will be permanently removed and cannot be recovered!",
                  ) && mutations.removeDrawing(drawingId)
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
  const configs = useRoomState((s) => s.config.ids);
  return (
    <>
      {configs.map((cid) => (
        <ConfigAsMenuItem key={cid} configId={cid} drawingId={drawingId} />
      ))}
    </>
  );
}

function ConfigAsMenuItem(props: { configId: string; drawingId: string }) {
  const config = useRoomState((s) => s.config.entities[props.configId]);
  const mutations = useMutations();
  const currentConfigId = useConfigId();
  return (
    <MenuItem
      intent={currentConfigId === props.configId ? "primary" : undefined}
      text={`${config.name} (${config.chartCount}@${config.lowerBound}-${config.upperBound})`}
      onClick={() => mutations.subdraw(props.drawingId, props.configId)}
    />
  );
}

export function DrawingActions() {
  const mutations = useMutations();
  const { t } = useIntl();
  const cabs = useRoomState((s) => Object.values(s.event.cabs));
  const drawingId = useDrawing((s) => s.compoundId);
  const drawingMeta = useDrawing((s) => s.meta);
  const subDrawingCharts = useRoomState((s) => {
    const [mainId, subId] = drawingId;
    return s.drawings.entities[mainId]?.subDrawings?.[subId]?.charts ?? [];
  });
  const highlighAtRandom = useHighlightRandom();
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
            mutations.assignToCab(cab.id, drawingId)
          }
        />
      ))}
    </Menu>
  );

  return (
    <div className={styles.networkButtons}>
      <Tooltip content={t("drawing.pickRandom", undefined, "Pick Random")}>
        <Button
          variant="minimal"
          icon={<Random />}
          onClick={highlighAtRandom}
        />
      </Tooltip>
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
          icon={<ThVirtual />}
          onClick={() =>
            shareCharts(
              subDrawingCharts.filter((c) => c.type === "DRAWN"),
              "drawn",
            )
          }
        />
      </Tooltip>
      {process.env.NODE_ENV === "production" ? null : (
        <Tooltip content="Cause Error">
          <Button
            variant="minimal"
            icon={<ErrorIcon />}
            onClick={() => showBoundary(new Error("synthetic error"))}
          />
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
  const mutations = useMutations();
  const cabs = useRoomState((s) => Object.values(s.event.cabs));

  const addToCabMenu = (
    <Menu>
      {cabs.map((cab) => (
        <MenuItem
          key={cab.id}
          text={cab.name}
          onClick={() =>
            mutations.assignToCab(cab.id, drawingId)
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
  const mutations = useMutations();
  const [metaEditorOpen, setMetaEditorOpen] = useState(false);
  const drawingMeta = useRoomState((s) => s.drawings.entities[drawingId].meta);
  const configId = useRoomState((s) => s.drawings.entities[drawingId].configId);
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
            mutations.updateDrawingMeta(drawingId, meta, times(meta.players.length, (n) => n - 1));
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
        onClick={() => mutations.mergeDraws(drawingId)}
      />
      {showLabels && isTwoPlayers && (
        <MenuItem
          text="Swap Player Positions"
          icon={<Exchange />}
          onClick={() => {
            mutations.swapPlayerPositions(drawingId);
          }}
        />
      )}
      <MenuItem
        text="Delete this match"
        icon={<Trash />}
        onClick={() =>
          confirm(
            "This match will be permanently removed and cannot be recovered!",
          ) && mutations.removeDrawing([drawingId, ""])
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

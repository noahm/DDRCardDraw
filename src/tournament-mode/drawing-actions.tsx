import { ActionIcon, Menu, Modal, Tooltip } from "@mantine/core";
import {
  IconCamera,
  IconSitemap,
  IconShare2,
  IconArrowsShuffle,
  IconEdit,
  IconExclamationCircle,
  IconArrowsExchange,
  IconTag,
  IconStack,
  IconStack2,
  IconRefresh,
  IconSend,
  IconTableExport,
  IconTable,
  IconTableOptions,
  IconTrash,
  IconScribble,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { domToPng } from "modern-screenshot";
import { useState, lazy, JSX, ReactNode } from "react";
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
import { useHighlightRandom } from "./highlight-random";

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

function ToolbarButton(props: {
  label: ReactNode;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tooltipColor?: string;
}) {
  return (
    <Tooltip label={props.label} color={props.tooltipColor}>
      <ActionIcon
        variant="subtle"
        color="gray"
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {props.icon}
      </ActionIcon>
    </Tooltip>
  );
}

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
    <ToolbarButton
      label={tooltipContent}
      tooltipColor={mutationData.error ? "red" : undefined}
      disabled={mutationData.fetching}
      icon={<IconTableExport size={18} />}
      onClick={() => {
        const results = dispatch(getMatchResult(drawingId));
        if (!results) {
          return;
        }
        void reportSet(results);
      }}
    />
  );
}

function EditSetMenu() {
  const dispatch = useAppDispatch();
  const { t } = useIntl();
  const drawingId = useDrawing((s) => s.compoundId);

  return (
    <Menu>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="Alter Set">
          <IconEdit size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconStack size={16} />}
          onClick={() => dispatch(createPlusOneChart(drawingId, CHART_DRAWN))}
        >
          Draw Another Chart
        </Menu.Item>
        <Menu.Item
          leftSection={<IconScribble size={16} />}
          onClick={() =>
            dispatch(createPlusOneChart(drawingId, CHART_PLACEHOLDER))
          }
        >
          Add New Player Pick
        </Menu.Item>
        <Menu.Item
          leftSection={<IconRefresh size={16} />}
          onClick={() =>
            confirm(
              t(
                "drawing.redrawConfirm",
                undefined,
                "This will replace everything besides protects and picks!",
              ),
            ) && dispatch(createRedrawAll(drawingId))
          }
        >
          {t("drawing.redrawAll", undefined, "Redraw set")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconTrash size={16} />}
          onClick={() =>
            confirm(
              "This draw will be permanently removed and cannot be recovered!",
            ) && dispatch(drawingsSlice.actions.removeOne(drawingId))
          }
        >
          Delete this set
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
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
    <Menu.Item
      color={currentConfigId === props.configId ? "blue" : undefined}
      onClick={() => dispatch(createSubdraw(props.drawingId, props.configId))}
    >
      {`${config.name} (${config.chartCount}@${config.lowerBound}-${config.upperBound})`}
    </Menu.Item>
  );
}

export function DrawingActions() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { t } = useIntl();
  const cabs = useAppState(eventSlice.selectors.allCabs);
  const drawingId = useDrawing((s) => s.compoundId);
  const drawingMeta = useDrawing((s) => s.meta);
  const highlighAtRandom = useHighlightRandom();
  const isGauntlet =
    drawingMeta.type === "startgg" && drawingMeta.subtype === "gauntlet";
  const { showBoundary } = useErrorBoundary();
  const [gauntletEditorMeta, setGauntletEditorMeta] = useState<
    StartggGauntletMeta | undefined
  >(undefined);

  return (
    <div className={styles.networkButtons}>
      <ToolbarButton
        label={t("drawing.pickRandom", undefined, "Pick Random")}
        icon={<IconArrowsShuffle size={18} />}
        onClick={highlighAtRandom}
      />
      <ToolbarButton
        label={t("drawing.saveImage", undefined, "Save image")}
        icon={<IconCamera size={18} />}
        onClick={async () => {
          const drawingElement = document.querySelector(
            "#drawing-" + drawingId[1],
          );
          if (drawingElement) {
            await shareImage(
              await domToPng(drawingElement, { scale: 2 }),
              DEFAULT_FILENAME,
            );
          }
        }}
      />
      <ToolbarButton
        label={t("drawing.copyCards", undefined, "Save as CSV")}
        icon={<IconTableOptions size={18} />}
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
      {process.env.NODE_ENV === "production" ? null : (
        <ToolbarButton
          label="Cause Error"
          icon={<IconExclamationCircle size={18} />}
          onClick={() => showBoundary(new Error("synthetic error"))}
        />
      )}
      <EventModeGated>
        {!!cabs.length && (
          <Menu position="bottom">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Assign Set to Cab"
                title="Assign Set to Cab"
              >
                <IconSend size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {cabs.map((cab) => (
                <Menu.Item
                  key={cab.id}
                  onClick={() =>
                    dispatch(
                      eventSlice.actions.assignSetToCab({
                        cabId: cab.id,
                        matchId: drawingId,
                      }),
                    )
                  }
                >
                  {cab.name}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
      </EventModeGated>
      {isGauntlet && (
        <>
          <ToolbarButton
            label="Edit Gauntlet Scores"
            icon={<IconTable size={18} />}
            onClick={() => {
              setGauntletEditorMeta(drawingMeta);
            }}
          />
          <Modal
            onClose={() => setGauntletEditorMeta(undefined)}
            opened={!!gauntletEditorMeta}
            title="Gauntlet Scores Editor"
            size="auto"
          >
            <GauntletEditor meta={gauntletEditorMeta!} />
          </Modal>
        </>
      )}
      <EditSetMenu />
    </div>
  );
}

export function MatchActions({ drawingId }: { drawingId: string }) {
  const dispatch = useAppDispatch();
  const cabs = useAppState(eventSlice.selectors.allCabs);

  return (
    <div className={styles.networkButtons}>
      <EventModeGated>
        {!!cabs.length && (
          <Menu position="bottom">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Assign Match to Cab"
                title="Assign Match to Cab"
              >
                <IconShare2 size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {cabs.map((cab) => (
                <Menu.Item
                  key={cab.id}
                  onClick={() =>
                    dispatch(
                      eventSlice.actions.assignMatchToCab({
                        cabId: cab.id,
                        matchId: drawingId,
                      }),
                    )
                  }
                >
                  {cab.name}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
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

  return (
    <>
      <Modal
        opened={metaEditorOpen}
        title="Edit Match"
        onClose={() => setMetaEditorOpen(false)}
      >
        {editPlayersDialog}
      </Modal>
      <Menu>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Alter Match"
            title="Alter Match"
          >
            <IconEdit size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {editPlayersDialog && (
            <Menu.Item
              leftSection={<IconTag size={16} />}
              onClick={() => setMetaEditorOpen(true)}
            >
              Edit Title & Players
            </Menu.Item>
          )}
          <Menu.Sub>
            <Menu.Sub.Target>
              <Menu.Sub.Item leftSection={<IconStack2 size={16} />}>
                Draw Extra Set
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown>
              <ConfigContextProvider value={configId}>
                <ConfigsAsMenuItems drawingId={drawingId} />
              </ConfigContextProvider>
            </Menu.Sub.Dropdown>
          </Menu.Sub>
          <Menu.Item
            leftSection={<IconSitemap size={16} />}
            onClick={() => dispatch(mergeDraws({ drawingId }))}
          >
            Merge All Sets
          </Menu.Item>
          {showLabels && isTwoPlayers && (
            <Menu.Item
              leftSection={<IconArrowsExchange size={16} />}
              onClick={() => {
                dispatch(drawingsSlice.actions.swapPlayerPositions(drawingId));
              }}
            >
              Swap Player Positions
            </Menu.Item>
          )}
          <Menu.Item
            leftSection={<IconTrash size={16} />}
            onClick={() =>
              confirm(
                "This match will be permanently removed and cannot be recovered!",
              ) && dispatch(drawingsSlice.actions.removeOne([drawingId, ""]))
            }
          >
            Delete this match
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}

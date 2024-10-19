import { Button, Menu, MenuItem, Popover, Tooltip } from "@blueprintjs/core";
import {
  Camera,
  Refresh,
  Error,
  CubeAdd,
  Exchange,
  FloppyDisk,
  NewLayer,
  Trash,
} from "@blueprintjs/icons";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-actions.css";
import { domToPng } from "modern-screenshot";
import { shareImage } from "../utils/share";
import { useErrorBoundary } from "react-error-boundary";
import { AppThunk, useAppDispatch, useAppState } from "../state/store";
import { useAtomValue } from "jotai";
import { showPlayerAndRoundLabels } from "../config-state";
import { drawingsSlice } from "../state/drawings.slice";
import { eventSlice } from "../state/event.slice";
import { createPlusOneChart, createRedrawAll } from "../state/thunks";
import {
  useReportSetMutation,
  ReportSetMutationVariables as MutationVariables,
  BracketSetGameDataInput as GDI,
} from "../startgg-gql";
import { CountingSet } from "../utils/counting-set";
import { playerCount } from "../models/Drawing";

/** thunk that dispatches nothing, but calculates the result to be sent to startgg */
function getMatchResult(
  drawingId: string,
): AppThunk<MutationVariables | undefined> {
  return (_, getState): MutationVariables | undefined => {
    const s = getState();
    const gameData: Array<GDI> = [];
    const drawing = s.drawings.entities[drawingId];
    if (drawing.meta.type !== "startgg") {
      return;
    }
    const winsPerPlayer = new CountingSet<string>();
    for (const [songId, pIdx] of Object.entries(drawing.winners)) {
      if (pIdx === null) {
        continue;
      }
      try {
        const entrant = drawing.meta.entrants[pIdx];
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
      setId: drawing.meta.id,
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
  const drawingId = useDrawing((s) => s.id);
  const drawingMeta = useDrawing((s) => s.meta);
  const [mutationData, reportSet] = useReportSetMutation();
  if (drawingMeta.type !== "startgg") {
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
        minimal
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

function AddCardButton() {
  const dispatch = useAppDispatch();
  const drawingId = useDrawing((s) => s.id);
  return (
    <Tooltip content="Draw Another Chart">
      <Button
        minimal
        icon={<NewLayer />}
        onClick={() => {
          dispatch(createPlusOneChart(drawingId));
        }}
      />
    </Tooltip>
  );
}

export function DrawingActions() {
  const dispatch = useAppDispatch();
  const cabs = useAppState(eventSlice.selectors.allCabs);
  const drawingId = useDrawing((s) => s.id);
  const isTwoPlayers = useDrawing((s) => playerCount(s.meta) === 2);
  const showLabels = useAtomValue(showPlayerAndRoundLabels);
  const { showBoundary } = useErrorBoundary();

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
      <Tooltip content="Save Image">
        <Button
          minimal
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
      <Tooltip content="Redraw all charts">
        <Button
          minimal
          icon={<Refresh />}
          onClick={() =>
            confirm(
              "This will replace everything besides protects and picks!",
            ) && dispatch(createRedrawAll(drawingId))
          }
        />
      </Tooltip>
      {process.env.NODE_ENV === "production" ? null : (
        <Tooltip content="Cause Error">
          <Button minimal icon={<Error />} onClick={showBoundary} />
        </Tooltip>
      )}
      {!!cabs.length && (
        <Tooltip content="Assign to Cab">
          <Popover content={addToCabMenu} placement="bottom">
            <Button minimal icon={<CubeAdd />} />
          </Popover>
        </Tooltip>
      )}
      {showLabels && isTwoPlayers && (
        <Tooltip content="Swap Player Positions">
          <Button
            minimal
            icon={<Exchange />}
            onClick={() => {
              dispatch(drawingsSlice.actions.swapPlayerPositions(drawingId));
            }}
          />
        </Tooltip>
      )}
      <SaveToStartggButton />
      <AddCardButton />
      <Tooltip content="Delete this draw">
        <Button
          minimal
          icon={<Trash />}
          onClick={() =>
            confirm(
              "This draw will be permanently removed and cannot be recovered!",
            ) && dispatch(drawingsSlice.actions.removeOne(drawingId))
          }
        />
      </Tooltip>
    </div>
  );
}

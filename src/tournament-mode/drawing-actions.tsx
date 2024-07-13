import { Button, Menu, MenuItem, Popover, Tooltip } from "@blueprintjs/core";
import {
  Camera,
  Refresh,
  NewPerson,
  BlockedPerson,
  Error,
  CubeAdd,
} from "@blueprintjs/icons";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-actions.css";
import { domToPng } from "modern-screenshot";
import { shareImage } from "../utils/share";
import { useErrorBoundary } from "react-error-boundary";
import { useAppDispatch, useAppState, useAppStore } from "../state/store";
import { useAtomValue } from "jotai";
import { showPlayerAndRoundLabels } from "../config-state";
import { createRedrawAll, drawingsSlice } from "../state/drawings.slice";
import { eventSlice } from "../state/event.slice";

const DEFAULT_FILENAME = "card-draw.png";

export function DrawingActions() {
  const dispatch = useAppDispatch();
  const cabs = useAppState(eventSlice.selectors.allCabs);
  const drawingId = useDrawing((s) => s.id);
  const hasPlayers = useDrawing((s) => !!s.players.length);
  const showLabels = useAtomValue(showPlayerAndRoundLabels);
  const { showBoundary } = useErrorBoundary();
  const store = useAppStore();

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
            ) && dispatch(createRedrawAll(store.getState(), drawingId))
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
      {showLabels && (
        <>
          <Tooltip content="Add Player">
            <Button
              minimal
              icon={<NewPerson />}
              onClick={() => {
                dispatch(drawingsSlice.actions.addEmptyPlayer(drawingId));
              }}
            />
          </Tooltip>
          <Tooltip content="Remove Player" disabled={!hasPlayers}>
            <Button
              minimal
              icon={<BlockedPerson />}
              disabled={!hasPlayers}
              onClick={() => {
                dispatch(drawingsSlice.actions.dropPlayer(drawingId));
              }}
            />
          </Tooltip>
        </>
      )}
    </div>
  );
}

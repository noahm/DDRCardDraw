import { Button, Menu, MenuItem, Popover, Tooltip } from "@blueprintjs/core";
import { Camera, Refresh, Error, CubeAdd, Exchange } from "@blueprintjs/icons";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-actions.css";
import { domToPng } from "modern-screenshot";
import { shareImage } from "../utils/share";
import { useErrorBoundary } from "react-error-boundary";
import { useAppDispatch, useAppState } from "../state/store";
import { useAtomValue } from "jotai";
import { showPlayerAndRoundLabels } from "../config-state";
import { drawingsSlice } from "../state/drawings.slice";
import { eventSlice } from "../state/event.slice";
import { createRedrawAll } from "../state/thunks";

const DEFAULT_FILENAME = "card-draw.png";

export function DrawingActions() {
  const dispatch = useAppDispatch();
  const cabs = useAppState(eventSlice.selectors.allCabs);
  const drawingId = useDrawing((s) => s.id);
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
      {showLabels && (
        <>
          <Tooltip content="Swap Player Positions">
            <Button
              minimal
              icon={<Exchange />}
              onClick={() => {
                dispatch(drawingsSlice.actions.swapPlayerPositions(drawingId));
              }}
            />
          </Tooltip>
        </>
      )}
    </div>
  );
}

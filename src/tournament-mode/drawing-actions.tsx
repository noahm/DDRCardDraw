import { Button, Tooltip } from "@blueprintjs/core";
import {
  Camera,
  Refresh,
  NewPerson,
  BlockedPerson,
  Error,
} from "@blueprintjs/icons";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-actions.css";
import { domToPng } from "modern-screenshot";
import { shareImage } from "../utils/share";
import { useConfigState } from "../config-state";
import { useErrorBoundary } from "react-error-boundary";

const DEFAULT_FILENAME = "card-draw.png";

export function DrawingActions() {
  const getDrawing = useDrawing((s) => s.serializeSyncFields);
  const updateDrawing = useDrawing((s) => s.updateDrawing);
  const redrawAllCharts = useDrawing((s) => s.redrawAllCharts);
  const hasPlayers = useDrawing((s) => !!s.players.length);
  const showLabels = useConfigState((s) => s.showPlayerAndRoundLabels);
  const { showBoundary } = useErrorBoundary();

  return (
    <div className={styles.networkButtons}>
      <Tooltip content="Save Image">
        <Button
          minimal
          icon={<Camera />}
          onClick={async () => {
            const drawingId = getDrawing().id;
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
            ) && redrawAllCharts()
          }
        />
      </Tooltip>
      {process.env.NODE_ENV === "production" ? null : (
        <Tooltip content="Cause Error">
          <Button minimal icon={<Error />} onClick={showBoundary} />
        </Tooltip>
      )}
      {showLabels && (
        <>
          <Tooltip content="Add Player">
            <Button
              minimal
              icon={<NewPerson />}
              onClick={() => {
                updateDrawing((drawing) => {
                  const next = drawing.players.slice();
                  next.push("");
                  return { players: next };
                });
              }}
            />
          </Tooltip>
          <Tooltip content="Remove Player" disabled={!hasPlayers}>
            <Button
              minimal
              icon={<BlockedPerson />}
              disabled={!hasPlayers}
              onClick={() => {
                updateDrawing((drawing) => {
                  const next = drawing.players.slice();
                  next.pop();
                  return { players: next };
                });
              }}
            />
          </Tooltip>
        </>
      )}
    </div>
  );
}

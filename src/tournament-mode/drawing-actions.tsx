import { Button, Tooltip } from "@blueprintjs/core";
import {
  Camera,
  Refresh,
  FloppyDisk,
  NewPerson,
  BlockedPerson,
  Error as ErrorIcon,
} from "@blueprintjs/icons";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-actions.css";
import { domToPng } from "modern-screenshot";
import { shareImage, shareCharts } from "../utils/share";
import { useConfigState } from "../config-state";
import { useErrorBoundary } from "react-error-boundary";
import { useIntl } from "../hooks/useIntl";

const DEFAULT_FILENAME = "card-draw.png";

export function DrawingActions() {
  const { t } = useIntl();
  const getDrawing = useDrawing((s) => s.serializeDrawing);
  const updateDrawing = useDrawing((s) => s.updateDrawing);
  const redrawAllCharts = useDrawing((s) => s.redrawAllCharts);
  const hasPlayers = useDrawing((s) => !!s.players.length);
  const showLabels = useConfigState((s) => s.showPlayerAndRoundLabels);
  const { showBoundary } = useErrorBoundary();

  return (
    <div className={styles.actionButtons}>
      <Tooltip content={t("drawing.saveImage", undefined, "Save image")}>
        <Button
          variant="minimal"
          icon={<Camera />}
          onClick={async () => {
            const drawingId = getDrawing().id;
            const drawingElement = document.querySelector(
              "#drawing-" + drawingId,
            );
            if (drawingElement) {
              await shareImage(
                await domToPng(drawingElement, { scale: 2 }),
                DEFAULT_FILENAME,
              );
            }
          }}
        />
      </Tooltip>
      <Tooltip content={t("drawing.redrawAll", undefined, "Redraw all charts")}>
        <Button
          variant="minimal"
          icon={<Refresh />}
          onClick={() =>
            confirm(
              t(
                "drawing.redrawConfirm",
                undefined,
                "This will replace everything besides protects and picks!",
              ),
            ) && redrawAllCharts()
          }
        />
      </Tooltip>
      <Tooltip content={t("drawing.copyCards", undefined, "Save as CSV")}>
        <Button
          variant="minimal"
          icon={<FloppyDisk />}
          onClick={() =>
            shareCharts(
              getDrawing().charts.filter((c) => c.type === "DRAWN"),
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
      {showLabels && (
        <>
          <Tooltip content={t("drawing.addPlayer", undefined, "Add Player")}>
            <Button
              variant="minimal"
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
          <Tooltip
            content={t("drawing.removePlayer", undefined, "Remove Player")}
            disabled={!hasPlayers}
          >
            <Button
              variant="minimal"
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

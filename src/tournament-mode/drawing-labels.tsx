import { useCallback } from "react";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-labels.css";
import { Icon } from "@blueprintjs/core";
import { CaretLeft, CaretRight } from "@blueprintjs/icons";
import { useAtomValue } from "jotai";
import { showPlayerAndRoundLabels } from "../config-state";
import { useAppDispatch } from "../state/store";
import { drawingsSlice } from "../state/drawings.slice";
import { playerNameByDisplayPos } from "../models/Drawing";

export function SetLabels() {
  const showLabels = useAtomValue(showPlayerAndRoundLabels);
  const playerDisplayOrder = useDrawing((d) => d.playerDisplayOrder);
  const meta = useDrawing((d) => d.meta);
  if (!showLabels) {
    return null;
  }

  const psuedoDrawing = { meta, playerDisplayOrder };

  return (
    <div className={styles.headers}>
      <div className={styles.title}>{meta.title}</div>
      <div className={styles.players}>
        <span>{playerNameByDisplayPos(psuedoDrawing, 1)}</span>
        <Versus />
        <span>{playerNameByDisplayPos(psuedoDrawing, 2)}</span>
      </div>
    </div>
  );
}

function Versus() {
  const dispatch = useAppDispatch();
  const drawingId = useDrawing((s) => s.id);
  const ipp = useCallback(
    () => dispatch(drawingsSlice.actions.incrementPriorityPlayer(drawingId)),
    [dispatch, drawingId],
  );
  const priorityPlayer = useDrawing((s) => s.priorityPlayer);
  return (
    <div className={styles.versus} onClick={ipp}>
      <Icon
        icon={
          <CaretLeft
            style={{
              visibility: priorityPlayer === 1 ? "visible" : "hidden",
              verticalAlign: "middle",
            }}
          />
        }
      />
      {" vs "}
      <Icon
        icon={
          <CaretRight
            style={{
              visibility: priorityPlayer === 2 ? "visible" : "hidden",
              verticalAlign: "middle",
            }}
          />
        }
      />
    </div>
  );
}

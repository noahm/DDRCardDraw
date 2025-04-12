import { useCallback, Fragment } from "react";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-labels.css";
import { Icon } from "@blueprintjs/core";
import { CaretLeft, CaretRight } from "@blueprintjs/icons";
import { useAtomValue } from "jotai";
import { showPlayerAndRoundLabels } from "../config-state";
import { useAppDispatch } from "../state/store";
import { drawingsSlice } from "../state/drawings.slice";
import { getAllPlayers } from "../models/Drawing";
import { CountingSet } from "../utils/counting-set";

export function SetLabels() {
  const showLabels = useAtomValue(showPlayerAndRoundLabels);
  const playerDisplayOrder = useDrawing((d) => d.playerDisplayOrder);
  const meta = useDrawing((d) => d.meta);
  const winners = useDrawing((d) => d.winners);
  if (!showLabels) {
    return null;
  }

  const hideWins = meta.type === "startgg" && meta.subtype === "gauntlet";
  let winsPerPlayer: CountingSet<number> | undefined;
  if (!hideWins) {
    winsPerPlayer = new CountingSet<number>();
    for (const pIdx of Object.values(winners)) {
      if (pIdx === null) {
        continue;
      }
      winsPerPlayer.add(pIdx);
    }
  }

  const allPlayers = getAllPlayers({ meta, playerDisplayOrder });

  return (
    <div className={styles.headers}>
      <div className={styles.title}>{meta.title}</div>
      <div className={styles.players}>
        {allPlayers.map((name, idx) => {
          const winCount = winsPerPlayer ? (
            <> ({winsPerPlayer.get(playerDisplayOrder[idx])})</>
          ) : null;
          const ret = (
            <span key={idx}>
              {name}
              {winCount}
            </span>
          );
          if (allPlayers.length === 2 && idx === 0) {
            return (
              <Fragment key={idx}>
                {ret}
                <Versus />
              </Fragment>
            );
          }
          return ret;
        })}
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

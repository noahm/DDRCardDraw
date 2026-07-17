import { useCallback, Fragment } from "react";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-labels.css";
import { Icon } from "@blueprintjs/core";
import { CaretLeft, CaretRight } from "@blueprintjs/icons";
import { useAtomValue } from "jotai";
import { showPlayerAndRoundLabels } from "../config-state";
import { useAppDispatch } from "../state/store";
import { drawingsSlice } from "../state/drawings.slice";
import { CountingSet } from "../utils/counting-set";
import { playerDisplayName } from "../models/Drawing";

export function MatchLabels() {
  const showLabels = useAtomValue(showPlayerAndRoundLabels);
  const meta = useDrawing((d) => d.meta);
  const winners = useDrawing((d) => d.winners);
  if (!showLabels) {
    return null;
  }

  const hideWins = meta.type === "startgg" && meta.subtype === "gauntlet";
  let winsPerPlayer: CountingSet<string> | undefined;
  if (!hideWins) {
    winsPerPlayer = new CountingSet<string>();
    for (const pId of Object.values(winners)) {
      if (pId === null) {
        continue;
      }
      winsPerPlayer.add(pId);
    }
  }

  return (
    <div className={styles.headers}>
      <div className={styles.title}>{meta.title}</div>
      <div className={styles.players}>
        {meta.players.map((player, idx) => {
          const winCount = winsPerPlayer ? (
            <> ({winsPerPlayer.get(player.id)})</>
          ) : null;
          const ret = (
            <span key={idx}>
              {playerDisplayName(player, idx)}
              {winCount}
            </span>
          );
          if (meta.players.length === 2 && idx === 0) {
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
  const parentId = useDrawing((s) => s.id);
  const ipp = useCallback(
    () => dispatch(drawingsSlice.actions.incrementPriorityPlayer(parentId)),
    [dispatch, parentId],
  );
  const priorityPlayer = useDrawing((s) => s.priorityPlayer);
  const players = useDrawing((s) => s.meta.players);
  return (
    <div className={styles.versus} onClick={ipp}>
      <Icon
        icon={
          <CaretLeft
            style={{
              visibility:
                priorityPlayer === players[0]?.id ? "visible" : "hidden",
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
              visibility:
                priorityPlayer === players[1]?.id ? "visible" : "hidden",
              verticalAlign: "middle",
            }}
          />
        }
      />
    </div>
  );
}

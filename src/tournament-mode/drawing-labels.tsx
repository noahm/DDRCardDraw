import { useCallback } from "react";
import { useConfigState } from "../state/hooks";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-labels.css";
import { AutoCompleteSelect, RoundSelect } from "./round-select";
import { Icon } from "@blueprintjs/core";
import { CaretLeft, CaretRight } from "@blueprintjs/icons";
import { useAtomValue } from "jotai";
import { showPlayerAndRoundLabels } from "../config-state";
import { useAppDispatch } from "../state/store";
import { drawingsSlice } from "../state/drawings.slice";
import { addPlayerNameToDrawing } from "../state/central";

export function SetLabels() {
  const showLabels = useAtomValue(showPlayerAndRoundLabels);
  const players = useDrawing((s) => s.players);
  if (!showLabels) {
    return null;
  }

  return (
    <div className={styles.headers}>
      <div className={styles.title}>
        <RoundSelect />
      </div>
      <div className={styles.players}>
        {players.map((p, idx) => (
          <PlayerLabel
            key={idx}
            placeholder={`Player ${idx + 1}`}
            playerIndex={idx + 1}
          />
        ))}
      </div>
    </div>
  );
}

function Versus() {
  const players = useDrawing((s) => s.players);
  const dispatch = useAppDispatch();
  const drawingId = useDrawing((s) => s.id);
  const ipp = useCallback(
    () => dispatch(drawingsSlice.actions.incrementPriorityPlayer(drawingId)),
    [dispatch, drawingId],
  );
  const priorityPlayer = useDrawing((s) => s.priorityPlayer);
  if (players.length !== 2) {
    return null;
  }
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

function PlayerLabel({
  playerIndex,
  placeholder,
}: {
  playerIndex: number;
  placeholder: string;
}) {
  const value = useDrawing((s) => s.players[playerIndex - 1] || null);
  const drawingId = useDrawing((s) => s.id);
  const playerNames = useConfigState((s) => s.playerNames);
  const dispatch = useAppDispatch();
  const handleChange = useCallback(
    (value: string) => {
      dispatch(
        addPlayerNameToDrawing({
          name: value,
          asPlayerNo: playerIndex,
          drawingId,
        }),
      );
    },
    [drawingId, playerIndex, dispatch],
  );
  const ret = (
    <AutoCompleteSelect
      value={value}
      itemList={playerNames}
      placeholder={placeholder}
      onSelect={handleChange}
      size="large"
    />
  );
  if (playerIndex === 1) {
    return (
      <>
        {ret}
        <Versus />
      </>
    );
  }
  return ret;
}

import { useCallback } from "react";
import { useConfigState } from "../config-state";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-labels.css";
import { AutoCompleteSelect, RoundSelect } from "./round-select";

export function SetLabels() {
  const showLabels = useConfigState((s) => s.showPlayerAndRoundLabels);
  const players = useDrawing((s) => s.players);
  if (!showLabels) {
    return null;
  }

  return (
    <div className={styles.headers}>
      <div className={styles.title}>
        <RoundSelect />
      </div>
      {players.length === 2 && <div className={styles.versus}>vs</div>}
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

function PlayerLabel({
  playerIndex,
  placeholder,
}: {
  playerIndex: number;
  placeholder: string;
}) {
  const updateDrawing = useDrawing((s) => s.updateDrawing);
  const value = useDrawing((s) => s.players[playerIndex - 1] || null);
  const playerNames = useConfigState((s) => s.playerNames);
  const updateConfig = useConfigState((s) => s.update);
  const handleChange = useCallback(
    (value: string) => {
      updateDrawing((drawing) => {
        const prev = drawing.players.slice();
        prev[playerIndex - 1] = value;
        return { players: prev };
      });
      if (!playerNames.includes(value)) {
        updateConfig((prev) => {
          const nextNames = prev.playerNames.slice();
          nextNames.push(value);
          return { playerNames: nextNames };
        });
      }
    },
    [updateDrawing, playerIndex, playerNames, updateConfig],
  );
  return (
    <AutoCompleteSelect
      value={value}
      itemList={playerNames}
      placeholder={placeholder}
      onSelect={handleChange}
      size="large"
    />
  );
}

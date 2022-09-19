import { EditableText } from "@blueprintjs/core";
import { useCallback } from "react";
import { useDrawState } from "../draw-state";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-labels.css";

export function SetLabels() {
  const tournamentMode = useDrawState((s) => s.tournamentMode);
  if (!tournamentMode) {
    return null;
  }

  return (
    <div className={styles.headers}>
      <div className={styles.title}>
        <EditableDrawingField placeholder="Tournament Round" field="title" />
      </div>
      <div className={styles.versus}>vs</div>
      <div className={styles.players}>
        <EditableDrawingField placeholder="Player 1" field="player1" />
        <EditableDrawingField placeholder="Player 2" field="player2" />
      </div>
    </div>
  );
}

function EditableDrawingField({
  field,
  placeholder,
}: {
  field: "title" | "player1" | "player2";
  placeholder: string;
}) {
  const updateDrawing = useDrawing((s) => s.updateDrawing);
  const value = useDrawing((s) => s[field]);
  const handleChange = useCallback(
    (value: string) => {
      updateDrawing({ [field]: value });
    },
    [updateDrawing, field]
  );
  return (
    <EditableText
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  );
}

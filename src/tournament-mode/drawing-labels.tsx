import { EditableText } from "@blueprintjs/core";
import { useCallback } from "react";
import { useForceUpdate } from "../hooks/useForceUpdate";
import { Drawing } from "../models/Drawing";
import styles from "./drawing-labels.css";

export function SetLabels({ drawing }: { drawing: Drawing }) {
  return (
    <div className={styles.headers}>
      <div className={styles.title}>
        <BoundEditable
          placeholder="Tournament Round"
          drawing={drawing}
          field="title"
        />
      </div>
      <div className={styles.versus}>vs</div>
      <div className={styles.players}>
        <BoundEditable
          placeholder="Player 1"
          drawing={drawing}
          field="player1"
        />
        <BoundEditable
          placeholder="Player 2"
          drawing={drawing}
          field="player2"
        />
      </div>
    </div>
  );
}

function BoundEditable({
  drawing,
  field,
  placeholder,
}: {
  drawing: Drawing;
  field: "title" | "player1" | "player2";
  placeholder: string;
}) {
  const rerender = useForceUpdate();
  const handleChange = useCallback(
    (value: string) => {
      drawing[field] = value;
      rerender();
    },
    [rerender, drawing, field]
  );
  return (
    <EditableText
      placeholder={placeholder}
      value={drawing[field]}
      onChange={handleChange}
    />
  );
}

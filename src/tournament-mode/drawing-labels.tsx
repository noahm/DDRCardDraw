import { Button, EditableText, Icon } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Tooltip2 } from "@blueprintjs/popover2";
import { useCallback } from "react";
import { useDrawing } from "../drawing-context";
import { useForceUpdate } from "../hooks/useForceUpdate";
import { Drawing } from "../models/Drawing";
import styles from "./drawing-labels.css";
import { useRemotePeers } from "./remote-peers";

export function SetLabels() {
  const drawing = useDrawing();
  const remotePeers = useRemotePeers((s) => s.remotePeers);
  const sendDrawing = useRemotePeers((s) => s.sendDrawing);
  return (
    <div className={styles.headers}>
      <Tooltip2 content="Send to stream" className={styles.sendButton}>
        <Button
          disabled={!remotePeers.length}
          minimal
          onClick={() => sendDrawing(drawing.getAsSerializable())}
        >
          <Icon icon={IconNames.SendTo} />
        </Button>
      </Tooltip2>
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

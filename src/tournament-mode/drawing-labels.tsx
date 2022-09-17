import { Button, EditableText, Icon, Menu, MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Popover2, Tooltip2 } from "@blueprintjs/popover2";
import { useCallback } from "react";
import { useDrawing } from "../drawing-context";
import styles from "./drawing-labels.css";
import { CurrentPeersMenu } from "./remote-peer-menu";
import { useRemotePeers } from "./remote-peers";

export function SetLabels() {
  const getDrawing = useDrawing((s) => s.getAsSerializable);
  const hasRemotePeers = useRemotePeers((s) => !!s.remotePeers.size);
  const sendDrawing = useRemotePeers((s) => s.sendDrawing);

  const remotesMenu = (
    <Menu>
      <CurrentPeersMenu
        header="Choose a peer"
        onClickPeer={(peerId) => sendDrawing(peerId, getDrawing())}
      />
    </Menu>
  );
  return (
    <div className={styles.headers}>
      <Tooltip2 content="Send to stream" className={styles.sendButton}>
        <Popover2 content={remotesMenu}>
          <Button disabled={!hasRemotePeers} minimal>
            <Icon icon={IconNames.SendTo} />
          </Button>
        </Popover2>
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

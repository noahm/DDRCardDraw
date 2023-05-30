import { Button, Icon, Menu, MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Popover2, Tooltip2 } from "@blueprintjs/popover2";
import { ReactNode } from "react";
import { useDrawState } from "../draw-state";
import { useDrawing, useDrawingStore } from "../drawing-context";
import { firstOf } from "../utils";
import styles from "./networking-actions.css";
import { CurrentPeersMenu } from "./remote-peer-menu";
import { displayFromPeerId, useRemotePeers } from "./remote-peers";

export function NetworkingActions() {
  const getDrawing = useDrawing((s) => s.serializeSyncFields);
  const syncPeer = useDrawing((s) => s.__syncPeer);
  const isConnected = useRemotePeers((s) => !!s.thisPeer);
  const remotePeers = useRemotePeers((s) => s.remotePeers);
  const sendDrawing = useRemotePeers((s) => s.sendDrawing);
  const syncDrawing = useRemotePeers((s) => s.beginSyncWithPeer);
  const drawingStore = useDrawingStore();
  const tournamentMode = useDrawState((s) => s.tournamentMode);

  if (!isConnected) {
    return null;
  }

  let remoteActions: JSX.Element | undefined = undefined;

  if (remotePeers.size === 1) {
    const peerId = displayFromPeerId(firstOf(remotePeers.values())!.peer);
    remoteActions = (
      <Menu>
        <MenuItem
          icon={IconNames.SendMessage}
          text={`Send to ${peerId}`}
          onClick={() => sendDrawing(getDrawing())}
        />
        <MenuItem
          icon={IconNames.Changes}
          text={`Start sync with ${peerId}`}
          onClick={() => syncDrawing(drawingStore)}
        />
      </Menu>
    );
  } else if (remotePeers.size > 1) {
    remoteActions = (
      <Menu>
        <MenuItem icon={IconNames.SendMessage} text="Send to...">
          <CurrentPeersMenu
            disabled={syncPeer ? [syncPeer.peer] : false}
            onClickPeer={(peerId) => sendDrawing(getDrawing(), peerId)}
          />
        </MenuItem>
        <MenuItem icon={IconNames.Changes} text="Start sync with...">
          <CurrentPeersMenu
            disabled={syncPeer ? [syncPeer.peer] : false}
            onClickPeer={(peerId) => syncDrawing(drawingStore, peerId)}
          />
        </MenuItem>
      </Menu>
    );
  } else if (syncPeer) {
    remoteActions = undefined;
  }

  const button = (
    <Button
      minimal
      text={<Icon icon={IconNames.Share} />}
      disabled={!remotePeers.size}
    />
  );

  return (
    <>
      <div className={styles.sendButton}>
        {syncPeer && <Icon icon={IconNames.Changes} intent="success" />}
        {remotePeers.size ? (
          <Popover2 content={remoteActions}>{button}</Popover2>
        ) : (
          <Tooltip2 content="Connect to a peer to share">{button}</Tooltip2>
        )}
      </div>
      {!tournamentMode && <div style={{ height: "15px" }} />}
    </>
  );
}

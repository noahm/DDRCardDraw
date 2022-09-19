import { Button, Icon, Menu, MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Popover2, Tooltip2 } from "@blueprintjs/popover2";
import { useDrawState } from "../draw-state";
import { useDrawing, useDrawingStore } from "../drawing-context";
import styles from "./networking-actions.css";
import { CurrentPeersMenu } from "./remote-peer-menu";
import { useRemotePeers } from "./remote-peers";

export function NetworkingActions() {
  const getDrawing = useDrawing((s) => s.serializeSyncFields);
  const hasSyncPeers = useDrawing((s) => !!s.__syncPeers?.length);
  const isConnected = useRemotePeers((s) => !!s.thisPeer);
  const hasRemotePeers = useRemotePeers((s) => s.remotePeers.size > 0);
  const hasMultiplePeers = useRemotePeers((s) => s.remotePeers.size > 1);
  const sendDrawing = useRemotePeers((s) => s.sendDrawing);
  const syncDrawing = useRemotePeers((s) => s.beginSyncWithPeer);
  const drawingStore = useDrawingStore();
  const tournamentMode = useDrawState((s) => s.tournamentMode);

  if (!isConnected) {
    return null;
  }

  let remoteActions = (
    <Menu>
      <MenuItem
        icon={IconNames.SendMessage}
        text="Send to peer"
        onClick={() => sendDrawing(getDrawing())}
      />
      <MenuItem
        icon={IconNames.Changes}
        text="Start sync with peer"
        onClick={() => syncDrawing(drawingStore)}
      />
    </Menu>
  );

  if (hasMultiplePeers) {
    remoteActions = (
      <Menu>
        <MenuItem icon={IconNames.SendMessage} text="Send to...">
          <CurrentPeersMenu
            onClickPeer={(peerId) => sendDrawing(getDrawing(), peerId)}
          />
        </MenuItem>
        <MenuItem icon={IconNames.Changes} text="Start sync with...">
          <CurrentPeersMenu
            onClickPeer={(peerId) => syncDrawing(drawingStore, peerId)}
          />
        </MenuItem>
      </Menu>
    );
  }

  const button = (
    <Button
      minimal
      text={<Icon icon={IconNames.Share} />}
      disabled={!hasRemotePeers}
    />
  );

  return (
    <>
      <div className={styles.sendButton}>
        {hasSyncPeers && <Icon icon={IconNames.Changes} intent="success" />}
        {hasRemotePeers ? (
          <Popover2 content={remoteActions}>{button}</Popover2>
        ) : (
          <Tooltip2 content="Connect to a peer to share">{button}</Tooltip2>
        )}
      </div>
      {!tournamentMode && <div style={{ height: "15px" }} />}
    </>
  );
}

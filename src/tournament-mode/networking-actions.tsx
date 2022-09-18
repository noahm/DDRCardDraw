import { Button, Icon, Menu, MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Popover2, Tooltip2 } from "@blueprintjs/popover2";
import { useDrawing } from "../drawing-context";
import styles from "./networking-actions.css";
import { CurrentPeersMenu } from "./remote-peer-menu";
import { useRemotePeers } from "./remote-peers";

export function NetworkingActions() {
  const getDrawing = useDrawing((s) => s.getAsSerializable);
  const drawingId = useDrawing((s) => s.id);
  const isConnected = useRemotePeers((s) => !!s.thisPeer);
  const hasRemotePeers = useRemotePeers((s) => s.remotePeers.size > 0);
  const hasMultiplePeers = useRemotePeers((s) => s.remotePeers.size > 1);
  const sendDrawing = useRemotePeers((s) => s.sendDrawing);
  const syncDrawing = (...f: unknown[]) => null;

  if (!isConnected) {
    return null;
  }

  let remoteActions = (
    <Menu>
      <MenuItem
        icon={IconNames.SendMessage}
        text={hasMultiplePeers ? "Send to..." : "Send to peer"}
      />
      <MenuItem
        icon={IconNames.Changes}
        text={hasMultiplePeers ? "Start sync with..." : "Start sync with peer"}
      />
    </Menu>
  );

  if (hasMultiplePeers) {
    remoteActions = (
      <Menu>
        <MenuItem icon={IconNames.SendMessage} text="Send to...">
          <CurrentPeersMenu
            onClickPeer={(peerId) => sendDrawing(peerId, getDrawing())}
          />
        </MenuItem>
        <MenuItem icon={IconNames.Changes} text="Start sync with...">
          <CurrentPeersMenu
            onClickPeer={(peerId) => syncDrawing(peerId, drawingId)}
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
    <div className={styles.sendButton}>
      {hasRemotePeers ? (
        <Popover2 content={remoteActions}>{button}</Popover2>
      ) : (
        <Tooltip2 content="Connect to a peer to share">{button}</Tooltip2>
      )}
    </div>
  );
}

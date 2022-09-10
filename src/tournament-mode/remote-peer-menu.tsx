import { MenuDivider, MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { displayFromPeerId, useRemotePeers } from "./remote-peers";

export function RemotePeerMainMenu() {
  const peers = useRemotePeers();

  let displayName = "(set a name)";
  if (peers.thisPeer) {
    displayName = displayFromPeerId(peers.thisPeer.id);
  }

  const setRemoteName = () => {
    const newName = prompt("set remote name", peers.instanceName);
    if (newName !== null) peers.setName(newName);
  };

  if (!peers.thisPeer) {
    return (
      <MenuItem
        icon={IconNames.GLOBE_NETWORK}
        text="Pick Remote Name"
        onClick={setRemoteName}
      />
    );
  }

  return (
    <MenuItem
      icon={IconNames.GLOBE_NETWORK}
      onClick={setRemoteName}
      text={`Available as ${displayName}`}
    >
      <MenuItem
        disabled={!peers.thisPeer}
        text="Connect to..."
        onClick={() => {
          const peerId = prompt(
            'Enter remote name to connect to, in the form of "name#123"'
          );
          if (peerId) {
            peers.connect(peerId);
          }
        }}
      />
      {!!peers.remotePeers.length && <MenuDivider />}
      <CurrentPeersMenu disabled header="Current connections" />
    </MenuItem>
  );
}

interface PeerMenuProps {
  header?: string;
  disabled?: boolean;
  onClickPeer?(peerId: string): void;
  emptyState?: JSX.Element;
}

export function CurrentPeersMenu({
  disabled,
  onClickPeer,
  emptyState,
  header,
}: PeerMenuProps) {
  const peers = useRemotePeers((s) => s.remotePeers);

  if (!peers.length) {
    return emptyState || null;
  }

  return (
    <>
      {!!header && <MenuItem text={header} disabled />}
      {peers.map((dc) => (
        <MenuItem
          key={dc.peer}
          text={displayFromPeerId(dc.peer)}
          disabled={disabled}
          onClick={onClickPeer && (() => onClickPeer(dc.peer))}
        />
      ))}
    </>
  );
}

import { MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { displayFromPeerId, useRemotePeers } from "./remote-peers";

export function RemotePeerMenu() {
  const peers = useRemotePeers();

  let displayName = peers.instanceName;
  if (peers.instanceName && peers.instancePin) {
    displayName += `#${peers.instancePin}`;
  }
  if (!displayName) {
    displayName = "(set a name)";
  }

  return (
    <MenuItem icon={IconNames.GLOBE_NETWORK} text="Remotes">
      <MenuItem
        text={displayName}
        onClick={() => {
          const newName = prompt("set instance name", peers.instanceName);
          if (newName !== null) peers.setName(newName);
        }}
      />
      <MenuItem text="Connections">
        <MenuItem
          disabled={!peers.thisPeer}
          text="Add Connection"
          onClick={() => {
            const peerId = prompt(
              'Enter instance name to connect to, in the form of "name#123"'
            );
            if (peerId) {
              peers.connect(peerId);
            }
          }}
        />
        {peers.remotePeers.map((dc) => (
          <MenuItem key={dc.peer} text={displayFromPeerId(dc.peer)} />
        ))}
      </MenuItem>
    </MenuItem>
  );
}

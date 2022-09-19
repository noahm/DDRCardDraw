import {
  Tag,
  FormGroup,
  MenuItem,
  Icon,
  Collapse,
  H3,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { InputButtonPair } from "../controls/input-button-pair";
import { displayFromPeerId, useRemotePeers } from "./remote-peers";

export function RemotePeerControls() {
  const peers = useRemotePeers();

  let displayName = "(set a name)";
  if (peers.thisPeer) {
    displayName = displayFromPeerId(peers.thisPeer.id);
  }

  let coreControl: JSX.Element;
  if (peers.thisPeer) {
    coreControl = (
      <InputButtonPair
        key="connectedName"
        disableInput
        value={displayFromPeerId(peers.thisPeer.id)}
        buttonLabel="Disconnect"
        onClick={() => peers.setName("")}
      />
    );
  } else {
    coreControl = (
      <InputButtonPair
        placeholder="pick host name"
        onClick={peers.setName}
        buttonLabel="Listen"
        enterKeyHint="go"
      />
    );
  }

  return (
    <>
      <FormGroup
        label="Hostname"
        subLabel="Connect from other devices using this name"
      >
        {coreControl}
      </FormGroup>
      <Collapse isOpen={!!peers.thisPeer}>
        <FormGroup label="Connect to peer">
          <InputButtonPair
            placeholder="enter host name"
            buttonLabel="Connect"
            enterKeyHint="go"
            onClick={(v, input) => {
              peers.connect(v);
              input.value = "";
              input.blur();
            }}
          />
        </FormGroup>
        <FormGroup label="Current Peers">
          {peers.remotePeers.size > 0 ? (
            Array.from(peers.remotePeers).map(([_, p]) => (
              <Tag minimal large key={p.peer} onRemove={() => p.close()}>
                {displayFromPeerId(p.peer)}
              </Tag>
            ))
          ) : (
            <span>
              <Icon icon={IconNames.HeartBroken} /> No connections
            </span>
          )}
        </FormGroup>
      </Collapse>
    </>
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

  if (!peers.size) {
    return emptyState || null;
  }

  return (
    <>
      {!!header && <MenuItem text={header} disabled />}
      {Array.from(peers).map(([_, dc]) => (
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
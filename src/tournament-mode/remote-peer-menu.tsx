import {
  Tag,
  FormGroup,
  MenuItem,
  Icon,
  Collapse,
  Button,
  Intent,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { InputButtonPair } from "../controls/input-button-pair";
import { toaster } from "../toaster";
import { displayFromPeerId, useRemotePeers } from "./remote-peers";

export function RemotePeerControls() {
  const peers = useRemotePeers();

  let displayName = "(no name set)";
  if (peers.thisPeer) {
    displayName = displayFromPeerId(peers.thisPeer.id);
  }

  let coreControl: JSX.Element;
  // Copied to keyboard success toaster
  function copyToaster() {
    navigator.clipboard.writeText(displayName);
    toaster.show({
      message: "Hostname copied to clipboard",
      intent: Intent.SUCCESS,
      icon: IconNames.Clipboard,
    });
  }
  // Copy to keyboard button
  const copyButton = (
    <Button
      minimal
      icon={IconNames.Duplicate}
      onClick={() => {
        copyToaster();
      }}
    />
  );

  if (peers.thisPeer) {
    coreControl = (
      <InputButtonPair
        key="connectedName"
        disableInput
        value={displayFromPeerId(peers.thisPeer.id)}
        rightElement={copyButton}
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
            Array.from(peers.remotePeers).map(([, p]) => (
              <Tag minimal large key={p.peer} onRemove={() => p.close()}>
                {displayFromPeerId(p.peer)}
              </Tag>
            ))
          ) : (
            <span className="bp5-text-disabled">
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
  disabled?: boolean | Array<string>;
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

  let allDisabled = false;
  if (disabled === true) {
    allDisabled = true;
  }

  let disableById: string[] = [];
  if (Array.isArray(disabled)) {
    disableById = disabled;
  }

  return (
    <>
      {!!header && <MenuItem text={header} disabled />}
      {Array.from(peers).map(([, dc]) => (
        <MenuItem
          key={dc.peer}
          text={displayFromPeerId(dc.peer)}
          disabled={allDisabled || disableById.includes(dc.peer)}
          onClick={onClickPeer && (() => onClickPeer(dc.peer))}
        />
      ))}
    </>
  );
}

import {
  Button,
  Icon,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { useDrawing, useDrawingStore } from "../drawing-context";
import styles from "./drawing-actions.css";
import { CurrentPeersMenu } from "./remote-peer-menu";
import { displayFromPeerId, useRemotePeers } from "./remote-peers";
import { domToPng } from "modern-screenshot";
import { shareImage } from "../utils/share";
import { firstOf } from "../utils";
import { useConfigState } from "../config-state";
import { useErrorBoundary } from "react-error-boundary";

const DEFAULT_FILENAME = "card-draw.png";

export function DrawingActions() {
  const getDrawing = useDrawing((s) => s.serializeSyncFields);
  const updateDrawing = useDrawing((s) => s.updateDrawing);
  const redrawAllCharts = useDrawing((s) => s.redrawAllCharts);
  const hasPlayers = useDrawing((s) => !!s.players.length);
  const syncPeer = useDrawing((s) => s.__syncPeer);
  const isConnected = useRemotePeers((s) => !!s.thisPeer);
  const remotePeers = useRemotePeers((s) => s.remotePeers);
  const sendDrawing = useRemotePeers((s) => s.sendDrawing);
  const syncDrawing = useRemotePeers((s) => s.beginSyncWithPeer);
  const drawingStore = useDrawingStore();
  const showLabels = useConfigState((s) => s.showPlayerAndRoundLabels);
  const { showBoundary } = useErrorBoundary();

  let remoteActions: JSX.Element | undefined = undefined;

  const onlyRemote = firstOf(remotePeers.values());
  if (remotePeers.size === 1 && onlyRemote) {
    const peerId = displayFromPeerId(onlyRemote.peer);
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
      <div className={styles.networkButtons}>
        {syncPeer && <Icon icon={IconNames.Changes} intent="success" />}
        {isConnected ? (
          remotePeers.size ? (
            <Popover content={remoteActions}>{button}</Popover>
          ) : (
            <Tooltip content="Connect to a peer to share">{button}</Tooltip>
          )
        ) : null}
        <Tooltip content="Save Image">
          <Button
            minimal
            icon={IconNames.Camera}
            onClick={async () => {
              const drawingId = getDrawing().id;
              const drawingElement = document.querySelector(
                "#drawing-" + drawingId,
              );
              if (drawingElement) {
                shareImage(
                  await domToPng(drawingElement, {
                    scale: 2,
                  }),
                  DEFAULT_FILENAME,
                );
              }
            }}
          />
        </Tooltip>
        <Tooltip content="Redraw all charts">
          <Button
            minimal
            icon={IconNames.Refresh}
            onClick={() =>
              confirm(
                "This will replace everything besides protects and pocket picks!",
              ) && redrawAllCharts()
            }
          />
        </Tooltip>
        {process.env.NODE_ENV === "production" ? null : (
          <Tooltip content="Cause Error">
            <Button minimal icon={IconNames.Error} onClick={showBoundary} />
          </Tooltip>
        )}
        {showLabels && (
          <>
            <Tooltip content="Add Player">
              <Button
                minimal
                icon={IconNames.NewPerson}
                onClick={() => {
                  updateDrawing((drawing) => {
                    const next = drawing.players.slice();
                    next.push("");
                    return { players: next };
                  });
                }}
              />
            </Tooltip>
            <Tooltip content="Remove Player" disabled={!hasPlayers}>
              <Button
                minimal
                icon={IconNames.BlockedPerson}
                disabled={!hasPlayers}
                onClick={() => {
                  updateDrawing((drawing) => {
                    const next = drawing.players.slice();
                    next.pop();
                    return { players: next };
                  });
                }}
              />
            </Tooltip>
          </>
        )}
      </div>
    </>
  );
}

import {
  Button,
  Icon,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
} from "@blueprintjs/core";
import {
  SendMessage,
  Changes,
  Share,
  Camera,
  Refresh,
  FloppyDisk,
  NewPerson,
  BlockedPerson,
  Error,
} from "@blueprintjs/icons";
import { useDrawing, useDrawingStore } from "../drawing-context";
import styles from "./drawing-actions.css";
import { CurrentPeersMenu } from "./remote-peer-menu";
import { displayFromPeerId, useRemotePeers } from "./remote-peers";
import { domToPng } from "modern-screenshot";
import { shareImage, shareCharts } from "../utils/share";
import { firstOf } from "../utils";
import { useConfigState } from "../config-state";
import { useErrorBoundary } from "react-error-boundary";
import { useIntl } from "../hooks/useIntl";
import { JSX } from "react";

const DEFAULT_FILENAME = "card-draw.png";

export function DrawingActions() {
  const { t } = useIntl();
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
          icon={<SendMessage />}
          text={t("drawing.sendToOne", { peerId }, "Send to {peerId}")}
          onClick={() => sendDrawing(getDrawing())}
        />
        <MenuItem
          icon={<Changes />}
          text={t(
            "drawing.startSyncOne",
            { peerId },
            "Start sync with {peerId}",
          )}
          onClick={() => syncDrawing(drawingStore)}
        />
      </Menu>
    );
  } else if (remotePeers.size > 1) {
    remoteActions = (
      <Menu>
        <MenuItem
          icon={<SendMessage />}
          text={t("drawing.sendToPeer", undefined, "Send to...")}
        >
          <CurrentPeersMenu
            disabled={syncPeer ? [syncPeer.peer] : false}
            onClickPeer={(peerId) => sendDrawing(getDrawing(), peerId)}
          />
        </MenuItem>
        <MenuItem
          icon={<Changes />}
          text={t("drawing.startSync", undefined, "Start sync with...")}
        >
          <CurrentPeersMenu
            disabled={syncPeer ? [syncPeer.peer] : false}
            onClickPeer={(peerId) => syncDrawing(drawingStore, peerId)}
          />
        </MenuItem>
      </Menu>
    );
  }

  const button = (
    <Button variant="minimal" text={<Share />} disabled={!remotePeers.size} />
  );

  return (
    <div className={styles.networkButtons}>
      {syncPeer && <Icon icon={<Changes />} intent="success" />}
      {isConnected ? (
        remotePeers.size ? (
          <Popover content={remoteActions}>{button}</Popover>
        ) : (
          <Tooltip
            content={t(
              "drawing.connect",
              undefined,
              "Connect to a peer to share",
            )}
          >
            {button}
          </Tooltip>
        )
      ) : null}
      <Tooltip content={t("drawing.saveImage", undefined, "Save image")}>
        <Button
          variant="minimal"
          icon={<Camera />}
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
      <Tooltip content={t("drawing.redrawAll", undefined, "Redraw all charts")}>
        <Button
          variant="minimal"
          icon={<Refresh />}
          onClick={() =>
            confirm(
              t(
                "drawing.redrawConfirm",
                undefined,
                "This will replace everything besides protects and picks!",
              ),
            ) && redrawAllCharts()
          }
        />
      </Tooltip>
      <Tooltip content={t("drawing.copyCards", undefined, "Save as CSV")}>
        <Button
          variant="minimal"
          icon={<FloppyDisk />}
          onClick={() =>
            shareCharts(getDrawing().charts.filter((c) => c.type === "DRAWN"))
          }
        />
      </Tooltip>
      {process.env.NODE_ENV === "production" ? null : (
        <Tooltip content="Cause Error">
          <Button variant="minimal" icon={<Error />} onClick={showBoundary} />
        </Tooltip>
      )}
      {showLabels && (
        <>
          <Tooltip content={t("drawing.addPlayer", undefined, "Add Player")}>
            <Button
              variant="minimal"
              icon={<NewPerson />}
              onClick={() => {
                updateDrawing((drawing) => {
                  const next = drawing.players.slice();
                  next.push("");
                  return { players: next };
                });
              }}
            />
          </Tooltip>
          <Tooltip
            content={t("drawing.removePlayer", undefined, "Remove Player")}
            disabled={!hasPlayers}
          >
            <Button
              variant="minimal"
              icon={<BlockedPerson />}
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
  );
}

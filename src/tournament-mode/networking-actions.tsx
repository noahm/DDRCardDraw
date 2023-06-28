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
import { firstOf } from "../utils";
import styles from "./networking-actions.css";
import { CurrentPeersMenu } from "./remote-peer-menu";
import { displayFromPeerId, useRemotePeers } from "./remote-peers";
import { domToPng } from "modern-screenshot";
import { toaster } from "../toaster";

export function NetworkingActions() {
  const getDrawing = useDrawing((s) => s.serializeSyncFields);
  const syncPeer = useDrawing((s) => s.__syncPeer);
  const isConnected = useRemotePeers((s) => !!s.thisPeer);
  const remotePeers = useRemotePeers((s) => s.remotePeers);
  const sendDrawing = useRemotePeers((s) => s.sendDrawing);
  const syncDrawing = useRemotePeers((s) => s.beginSyncWithPeer);
  const drawingStore = useDrawingStore();

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
                "#drawing-" + drawingId
              );
              if (drawingElement) {
                shareImage(
                  await domToPng(drawingElement, {
                    scale: 2,
                  })
                );
              }
            }}
          />
        </Tooltip>
      </div>
    </>
  );
}

const DEFAULT_FILENAME = "card-draw.png";

function downloadDataUrl(dataUrl: string) {
  const link = document.createElement("a");
  link.download = DEFAULT_FILENAME;
  link.href = dataUrl;
  link.click();
}

function copyToClipboard(blob: Blob) {
  return navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob,
    }),
  ]);
}

export async function shareImage(dataUrl: string) {
  const agent: string =
    navigator.userAgent || navigator.vendor || (window as any).opera;
  const blob = dataUrlToBlob(dataUrl);
  if (
    typeof navigator.share !== "undefined" &&
    typeof navigator.canShare === "function" &&
    isMobile(agent)
  ) {
    const shareData: ShareData = {
      title: "DDR.tools card draw",
      files: [new File([blob], DEFAULT_FILENAME, { type: blob.type })],
    };
    if (navigator.canShare(shareData)) {
      return navigator.share(shareData).catch();
    }
  }
  try {
    await copyToClipboard(blob);
    toaster.show(
      {
        message: "Image copied to clipboard",
        icon: IconNames.PAPERCLIP,
      },
      "copy-drawing-image"
    );
    return;
  } catch {
    downloadDataUrl(dataUrl);
  }
}

export function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(",");
  const type = header.match(/data:(.+);/)?.[1] ?? undefined;
  const decoded = window.atob(base64);
  const length = decoded.length;
  const buffer = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    buffer[i] = decoded.charCodeAt(i);
  }
  return new Blob([buffer], { type });
}

// seemingly originally from this weird site
// http://detectmobilebrowsers.com/
const regexA =
  /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
const regexB =
  /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i;
function isMobile(agent: string) {
  return regexA.test(agent) || regexB.test(agent.substr(0, 4));
}

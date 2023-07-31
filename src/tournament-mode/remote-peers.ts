import { create, StoreApi } from "zustand";
import type { Peer, DataConnection } from "peerjs";
import { Drawing } from "../models/Drawing";
import { useDrawState } from "../draw-state";
import { toaster } from "../toaster";
import { Intent } from "@blueprintjs/core";
import {
  acceptIncomingSyncedStores,
  initShareWithPeer,
} from "../zustand/shared-zustand";
import type { DrawingContext } from "../drawing-context";
import { firstOf } from "../utils";

interface SharedDrawingMessage {
  type: "drawing";
  body: Drawing;
}

type PeerMessages = SharedDrawingMessage;

const REMOTE_STORE_TYPE = "DRAWING";

interface RemotePeerStore {
  instanceName: string;
  instancePin: string;
  thisPeer: Peer | null;
  remotePeers: Map<string, DataConnection>;
  connect(peerId: string | null): Promise<void>;
  setName(newName: string): Promise<void>;
  /** sends to the first peer if not specified */
  sendDrawing(drawing: Drawing, peerId?: string): void;
  /** syncs with first peer if not specified */
  beginSyncWithPeer(drawing: StoreApi<DrawingContext>, peerId?: string): void;
}

function genPin() {
  let pin = Math.floor(Math.random() * 10000).toString(10);
  while (pin.length < 4) {
    pin = "0" + pin;
  }
  return pin;
}

function peerIdFromDisplay(display: string) {
  return `ddr-tools ${display.replace("#", "_")}`;
}

export function displayFromPeerId(id: string) {
  return id.replace("ddr-tools ", "").replace("_", "#");
}

function peerId(name: string, pin: string) {
  return `ddr-tools ${name}_${pin}`;
}

function bindPeer(peer: Peer, resolve: () => void, reject: () => void) {
  peer.on("open", (id) => {
    console.log("connected to peer signaling server with id", id);
    toaster.show({
      message: `Available for connections as ${displayFromPeerId(id)}`,
      intent: Intent.SUCCESS,
    });
    resolve();
  });
  peer.on("close", () => {
    console.log("peer has been closed");
    cleanup();
  });
  peer.on("disconnected", () => {
    console.log("disconnected from signaling server, reconnecting in 1s");
    setTimeout(() => {
      if (peer.disconnected && !peer.destroyed) {
        peer.reconnect();
      }
    }, 1000);
  });
  peer.on("error", (err) => {
    console.log("likely fatal error from peerjs", err);
    cleanup();
    reject();
  });

  peer.on("connection", (conn) => {
    console.log("new connection from peer", conn.peer, conn.metadata);
    toaster.show({
      message: `Remote peer ${displayFromPeerId(conn.peer)} connected`,
      intent: Intent.SUCCESS,
    });
    bindPeerConn(conn);
  });

  useRemotePeers.setState({
    thisPeer: peer,
  });
  function cleanup() {
    useRemotePeers.setState({
      thisPeer: null,
      remotePeers: new Map(),
    });
  }
}

function bindPeerConn(conn: DataConnection) {
  conn.on("close", () => {
    console.log("remote peer connection closed", conn.peer);
    removePeer();
  });
  conn.on("error", (err) => {
    console.log("likely fatal error from remote peer", err, conn.peer);
    removePeer();
  });

  conn.on("data", (data: PeerMessages) => {
    switch (data.type) {
      case "drawing":
        console.log("received drawing from peer", data.body);
        useDrawState.getState().injectRemoteDrawing(data.body);
        break;
      default:
        console.log("received unknown data from remote peer", data, conn.peer);
    }
  });

  acceptIncomingSyncedStores<Drawing>(
    REMOTE_STORE_TYPE,
    conn,
    (initialState) => {
      useDrawState.getState().injectRemoteDrawing(initialState, conn);
    },
  );

  useRemotePeers.setState((prev) => {
    const rp = new Map(prev.remotePeers);
    rp.set(conn.peer, conn);
    return {
      remotePeers: rp,
    };
  });

  function removePeer() {
    toaster.show(
      {
        message: `Remote peer ${displayFromPeerId(conn.peer)} disconnected`,
        intent: Intent.WARNING,
      },
      "removePeer",
    );
    const rp = new Map(useRemotePeers.getState().remotePeers);
    if (rp.delete(conn.peer)) {
      useRemotePeers.setState({
        remotePeers: rp,
      });
    }
  }
}

export const useRemotePeers = create<RemotePeerStore>((set, get) => ({
  instanceName: "",
  instancePin: "",
  thisPeer: null,
  remotePeers: new Map(),
  connect(peerId) {
    const { thisPeer } = get();
    if (!thisPeer) {
      return Promise.reject("connection to server not established");
    }
    if (!peerId) {
      return Promise.reject("invalid peer id");
    }
    return new Promise((res) => {
      const conn = thisPeer.connect(peerIdFromDisplay(peerId));
      conn.on("open", () => {
        bindPeerConn(conn);
        toaster.show({
          message: `Connected to remote peer ${displayFromPeerId(conn.peer)}`,
          intent: Intent.SUCCESS,
        });
        res();
      });
    });
  },
  async setName(newName) {
    if (!newName) {
      const state = get();
      if (state.thisPeer) {
        state.thisPeer.destroy();
      }
      set({
        thisPeer: null,
        instanceName: "",
      });
    } else {
      const peerLib = await import("peerjs");
      return new Promise((res, rej) => {
        const newPin = genPin();
        const peer = new peerLib.Peer(peerId(newName, newPin));
        bindPeer(peer, res, rej);
        set({
          instanceName: newName,
          instancePin: newPin,
          thisPeer: peer,
        });
      });
    }
  },
  sendDrawing(drawing, peerId) {
    const state = get();
    let targetPeer: DataConnection;
    if (!peerId) {
      const result = firstOf(state.remotePeers.values());
      if (!result) {
        console.error("tried to send drawing when no peers are connected");
        return;
      }
      targetPeer = result;
    } else {
      const foundPeer = state.remotePeers.get(peerId);
      if (!foundPeer) {
        console.error("tried to send to non-existent peer");
        return;
      }
      targetPeer = foundPeer;
    }
    targetPeer.send(<SharedDrawingMessage>{
      type: "drawing",
      body: drawing,
    });
  },
  beginSyncWithPeer(drawingStore, peerId) {
    const state = get();
    let targetPeer: DataConnection;
    if (!peerId) {
      const result = firstOf(state.remotePeers.values());
      if (!result) {
        console.error("tried to send drawing when no peers are connected");
        return;
      }
      targetPeer = result;
    } else {
      const foundPeer = state.remotePeers.get(peerId);
      if (!foundPeer) {
        console.error("tried to send to non-existent peer");
        return;
      }
      targetPeer = foundPeer;
    }
    initShareWithPeer(REMOTE_STORE_TYPE, drawingStore, targetPeer);
    drawingStore.setState({
      __syncPeer: targetPeer,
    });
  },
}));

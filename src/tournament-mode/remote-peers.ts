import createStore from "zustand";
import { Peer, DataConnection } from "peerjs";
import { Drawing } from "../models/Drawing";
import { useDrawState } from "../draw-state";
import { toaster } from "../toaster";
import { Intent } from "@blueprintjs/core";

interface SharedDrawingMessage {
  type: "drawing";
  body: Drawing;
}

type PeerMessages = SharedDrawingMessage;

interface RemotePeerStore {
  instanceName: string;
  instancePin: string;
  thisPeer: Peer | null;
  remotePeers: Array<DataConnection>;
  connect(peerId: string | null): Promise<void>;
  setName(newName: string): Promise<void>;
  sendDrawing(peerId: string, drawing: Drawing): void;
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

function bindPeer(peer: Peer, resolve: Function, reject: Function) {
  let errored = false;
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
    if (!errored) {
      console.log("disconnected from signaling server, reconnecting in 1s");
      setTimeout(() => {
        peer.reconnect();
      }, 1000);
    } else {
      console.log(
        "disconnected from signaling server due to error, not reconnecting"
      );
    }
  });
  peer.on("error", (err) => {
    errored = true;
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
      remotePeers: [],
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

  useRemotePeers.setState((prev) => ({
    remotePeers: [...prev.remotePeers, conn],
  }));

  function removePeer() {
    let found = false;
    const newRemotes = useRemotePeers
      .getState()
      .remotePeers.filter((remote) => {
        if (remote !== conn) {
          return false;
        }
        found = true;
        return true;
      });
    if (found) {
      useRemotePeers.setState((prev) => ({
        remotePeers: newRemotes,
      }));
    }
  }
}

export const useRemotePeers = createStore<RemotePeerStore>((set, get) => ({
  instanceName: "",
  instancePin: "",
  thisPeer: null,
  remotePeers: [],
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
  setName(newName) {
    if (!newName) {
      set({});
    }
    return new Promise((res, rej) => {
      const newPin = genPin();
      const peer = new Peer(peerId(newName, newPin));
      bindPeer(peer, res, rej);
      set({
        instanceName: newName,
        instancePin: newPin,
        thisPeer: peer,
      });
    });
  },
  sendDrawing(peerId, drawing) {
    const state = get();
    const targetPeer = state.remotePeers.find((p) => p.peer === peerId);
    if (targetPeer) {
      targetPeer.send(<SharedDrawingMessage>{
        type: "drawing",
        body: drawing,
      });
    }
  },
}));

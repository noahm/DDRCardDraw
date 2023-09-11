import { useEffect } from "react";
import { useDrawing, useDrawingStore } from "../drawing-context";
import { syncStoreWithPeer } from "../zustand/shared-zustand";
import { useRemotePeers } from "./remote-peers";

export function SyncWithPeers() {
  const drawing = useDrawing();
  const store = useDrawingStore();
  const remotePeer = useRemotePeers((s) => {
    if (drawing.__syncPeer) return s.remotePeers.get(drawing.__syncPeer.peer);
  });

  useEffect(() => {
    if (!remotePeer && drawing.__syncPeer) {
      drawing.updateDrawing({ __syncPeer: undefined });
    }
  }, [drawing, remotePeer]);

  useEffect(() => {
    if (drawing.__syncPeer) {
      return syncStoreWithPeer(store, drawing.__syncPeer);
    }
  }, [drawing.__syncPeer, store]);

  return null;
}

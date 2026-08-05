import { DataConnection } from "peerjs";
import type { StoreApi } from "zustand";

export interface SerializibleStore<ReducedState> {
  id: string;
  serializeSyncFields(this: void): ReducedState;
}

type SyncMessages<T> = InitSync<T> | StateUpdate<T> | { type: "other" };

/** peerjs hands us `unknown` off the wire, since a remote peer can send anything */
function asSyncMessage<T>(data: unknown): SyncMessages<T> | undefined {
  if (data && typeof data === "object" && "type" in data) {
    return data as SyncMessages<T>;
  }
}

interface InitSync<State> {
  type: "syncedStore.init";
  storeType: string;
  storeId: string;
  timestamp: number;
  state: State;
}

interface StateUpdate<State> {
  type: "syncedStore.stateUpdate";
  storeId: string;
  timestamp: number;
  state: State;
}

export function acceptIncomingSyncedStores<SharedState>(
  storeType: string,
  peer: DataConnection,
  handleNewStore: (initialState: SharedState) => void,
) {
  const handlePeerMessage = (data: unknown) => {
    const evt = asSyncMessage<SharedState>(data);
    if (evt?.type !== "syncedStore.init") {
      return;
    }
    if (evt.storeType !== storeType) {
      return;
    }
    handleNewStore(evt.state);
  };

  peer.on("data", handlePeerMessage);

  return () => {
    peer.off("data", handlePeerMessage);
  };
}

export function initShareWithPeer(
  storeType: string,
  store: StoreApi<SerializibleStore<unknown>>,
  peer: DataConnection,
) {
  const state = store.getState();
  sendMessage(peer, {
    type: "syncedStore.init",
    storeType,
    storeId: state.id,
    state: state.serializeSyncFields(),
    timestamp: 0,
  });
}

function sendMessage(peer: DataConnection, msg: SyncMessages<unknown>) {
  // send is fire-and-forget, but can reject once the connection drops
  void Promise.resolve(peer.send(msg)).catch((reason: unknown) => {
    console.error("failed to send message to peer", peer.peer, reason);
  });
}

/**
 * Based on https://github.com/Tom-Julux/shared-zustand
 * @returns unsync function
 */
export function syncStoreWithPeer<State extends SerializibleStore<unknown>>(
  store: StoreApi<State>,
  peer: DataConnection,
) {
  const storeId = store.getState().id;
  let externalUpdate = false;
  let timestamp = 0;

  const handleStoreUpdate = (state: State) => {
    if (!externalUpdate) {
      timestamp = Date.now();
      sendMessage(peer, {
        type: "syncedStore.stateUpdate",
        storeId: state.id,
        timestamp,
        state: state.serializeSyncFields(),
      });
    }
    externalUpdate = false;
  };

  const handlePeerMessage = (data: unknown) => {
    const evt = asSyncMessage<State>(data);
    switch (evt?.type) {
      case "syncedStore.stateUpdate":
        if (evt.storeId !== storeId) {
          return;
        }
        break;
      default:
        return;
    }

    if (evt.timestamp <= timestamp) {
      return;
    }
    externalUpdate = true;
    timestamp = evt.timestamp;
    store.setState(evt.state);
  };

  const unsubscribeFromStore = store.subscribe(handleStoreUpdate);
  peer.on("data", handlePeerMessage);

  return () => {
    peer.off("data", handlePeerMessage);
    unsubscribeFromStore();
  };
}

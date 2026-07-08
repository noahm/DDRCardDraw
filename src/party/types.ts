import { Action } from "@reduxjs/toolkit";
import { AppState } from "../state/store";

export interface Roomstate {
  type: "roomstate";
  state: AppState;
  /**
   * ids of recently applied actions, so reconnecting clients can drop
   * pending re-sends whose effects are already baked into `state`
   */
  recentActionIds?: string[];
  /** the seq of the last action baked into `state` */
  seq?: number;
}

export interface ReduxAction {
  type: "action";
  action: Action;
  /** unique message id; when present the server confirms receipt with an ack */
  id?: string;
  /**
   * canonical order assigned by the server. Present on server broadcasts,
   * never on client sends. The server echoes a stamped copy of each action
   * back to its sender as the receipt confirmation.
   */
  seq?: number;
}

/** a server-ordered action: an id'd action that has been assigned its seq */
export type StampedAction = ReduxAction & { id: string; seq: number };

/** the server confirms it received and applied the action with this id */
export interface ActionAck {
  type: "ack";
  id: string;
}

/**
 * client → server: a gap in `seq` was observed on a live socket. Asks the
 * server to replay every stamped action after `since` so the client can
 * repair its confirmed state without taking a whole fresh snapshot.
 */
export interface CatchupRequest {
  type: "catchup";
  /** the last seq the client has confirmed; it wants everything after it */
  since: number;
}

/**
 * server → client: the stamped actions filling a requested gap, ascending by
 * seq (all with seq > the request's `since`). When the gap reaches back
 * further than the server's retained tail, the server sends a {@link Roomstate}
 * instead and the client resyncs wholesale.
 */
export interface CatchupResponse {
  type: "catchup";
  actions: StampedAction[];
}

/** client → server: application-level heartbeat */
export interface Ping {
  type: "ping";
}

/** server → client: heartbeat reply, proving the room actor is still live */
export interface Pong {
  type: "pong";
}

/** All messages a client may send to the server */
export type ClientMessage = ReduxAction | CatchupRequest | Ping;

/** All messages possibly sent by the server to clients */
export type Broadcast =
  | Roomstate
  | ReduxAction
  | ActionAck
  | CatchupResponse
  | Pong;

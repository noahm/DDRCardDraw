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

/** the server confirms it received and applied the action with this id */
export interface ActionAck {
  type: "ack";
  id: string;
}

/** All messages possibly sent by the server to clients */
export type Broadcast = Roomstate | ReduxAction | ActionAck;

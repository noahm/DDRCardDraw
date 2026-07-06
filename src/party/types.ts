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
}

export interface ReduxAction {
  type: "action";
  action: Action;
  /** unique message id; when present the server confirms receipt with an ack */
  id?: string;
}

/** the server confirms it received and applied the action with this id */
export interface ActionAck {
  type: "ack";
  id: string;
}

/** All messages possibly sent by the server to clients */
export type Broadcast = Roomstate | ReduxAction | ActionAck;

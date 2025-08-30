import { Action } from "@reduxjs/toolkit";
import { AppState } from "../state/store";

export interface Roomstate {
  type: "roomstate";
  state: AppState;
}

export interface ReduxAction {
  type: "action";
  action: Action;
}

/** All messages possibly sent by the server to clients */
export type Broadcast = Roomstate | ReduxAction;

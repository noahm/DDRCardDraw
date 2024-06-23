import type { Serialized } from "../config-persistence";
import type { ConfigState } from "../config-state";
import type { Drawing } from "../models/Drawing";
import type { GameData } from "../models/SongData";

export interface Roomstate {
  type: "roomstate";
  dataSetName?: string;
  drawings: Drawing[];
  config?: Serialized<ConfigState>;
}

/** All messages possibly sent by the server to clients */
export type Broadcast = Roomstate | ClientMsg;

export interface DrawingUpdate {
  type: "drawings";
  drawings: Drawing[];
}

export interface ConfigChange {
  type: "config";
  config: Serialized<ConfigState>;
}

export interface DataSetChange {
  type: "dataSet";
  data: string | GameData;
}

export type ClientMsg = DrawingUpdate | ConfigChange | DataSetChange;

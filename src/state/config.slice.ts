import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ConfigState, initialState } from "../config-state";
import { loadGameDataByName } from "./thunks";
import { GameData } from "../models/SongData";
import { gameDataSlice } from "./game-data.slice";
import { store, useAppDispatch, useAppState } from "./store";
import { EqualityFn } from "react-redux";
import { addPlayerNameToDrawing } from "./central";

function createPartialFromDefaults(gameData: GameData) {
  const { lowerLvlBound, upperLvlBound, flags, difficulties, folders, style } =
    gameData.defaults;
  const ret: Partial<ConfigState> = {
    lowerBound: lowerLvlBound,
    upperBound: upperLvlBound,
    flags: new Set(flags),
    difficulties: new Set(difficulties),
    folders: new Set(folders),
    style,
    cutoffDate: "",
  };
  if (!gameData.meta.granularTierResolution) {
    ret.useGranularLevels = false;
  }
  return ret;
}

export const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    update: (state, action: PayloadAction<Partial<ConfigState>>) => {
      Object.assign(state, action.payload);
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadGameDataByName.fulfilled, (state, action) => {
        const patch = createPartialFromDefaults(action.payload);
        Object.assign(state, patch);
      })
      .addCase(gameDataSlice.actions.uploadGameData, (state, action) => {
        const patch = createPartialFromDefaults(action.payload.gameData);
        Object.assign(state, patch);
      })
      .addCase(addPlayerNameToDrawing, (state, action) => {
        if (!action.payload.name) {
          return;
        }
        if (state.playerNames.includes(action.payload.name)) {
          return;
        }
        state.playerNames.push(action.payload.name);
      });
  },
});

export const { actions } = configSlice;

export function useConfigState<T = ConfigState>(
  selector?: (state: ConfigState) => T,
  equalityFn?: EqualityFn<T>,
) {
  return useAppState((state) => {
    const sliceState = configSlice.selectSlice(state);
    if (!selector) return sliceState as T;
    return selector(sliceState);
  }, equalityFn);
}

export function useUpdateConfig() {
  const dispatch = useAppDispatch();
  return (
    patch:
      | Partial<ConfigState>
      | ((state: ConfigState) => Partial<ConfigState>),
  ) => {
    if (typeof patch === "function") {
      const state = configSlice.selectSlice(store.getState());
      patch = patch(state);
    }
    dispatch(actions.update(patch));
  };
}

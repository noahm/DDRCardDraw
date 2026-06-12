import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { nanoid } from "nanoid";
import { CompoundSetId } from "../models/Drawing";
import { mergeDraws } from "./central";

export interface CabInfo {
  /** drawing id if active */
  activeMatch: CompoundSetId | string | null;
  name: string;
  id: string;
}

interface EventState {
  eventName: string;
  cabs: Record<string, CabInfo>;
  obsLabels: Record<string, { label: string; value: string }>;
  obsCss: string;
}

const initialState: EventState = {
  eventName: "",
  cabs: {
    default: {
      id: "default",
      name: "Primary Cab",
      activeMatch: null,
    },
  },
  obsLabels: {},
  obsCss: `h1 {
  /* add text styles here */
}`,
};

export const eventSlice = createSlice({
  name: "event",
  initialState,
  reducers: {
    /** add a cab with its name */
    addCab(state, action: PayloadAction<string>) {
      const newCab: CabInfo = {
        id: nanoid(5),
        name: action.payload,
        activeMatch: null,
      };
      state.cabs[newCab.id] = newCab;
    },
    removeCab(state, action: PayloadAction<string>) {
      delete state.cabs[action.payload];
    },
    clearCabAssignment(state, action: PayloadAction<string>) {
      const cab = state.cabs[action.payload];
      if (!cab) return;
      cab.activeMatch = null;
    },
    assignMatchToCab(
      state,
      action: PayloadAction<{ cabId: string; matchId: string }>,
    ) {
      const cab = state.cabs[action.payload.cabId];
      if (!cab) return;
      cab.activeMatch = action.payload.matchId;
    },
    assignSetToCab(
      state,
      action: PayloadAction<{ cabId: string; matchId: CompoundSetId }>,
    ) {
      const cab = state.cabs[action.payload.cabId];
      if (!cab) return;
      cab.activeMatch = action.payload.matchId;
    },
    updateLabel(
      state,
      action: PayloadAction<{ id: string; value: string; label: string }>,
    ) {
      state.obsLabels[action.payload.id] = {
        label: action.payload.label,
        value: action.payload.value,
      };
    },
    removeLabel(state, action: PayloadAction<{ id: string }>) {
      delete state.obsLabels[action.payload.id];
    },
    updateObsCss(state, action: PayloadAction<string>) {
      state.obsCss = action.payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(mergeDraws, (state, { payload }) => {
      for (const cab of Object.values(state.cabs)) {
        if (
          Array.isArray(cab.activeMatch) &&
          cab.activeMatch[0] === payload.drawingId
        ) {
          cab.activeMatch[1] = payload.newSubdrawId;
        }
      }
    });
  },
  selectors: {
    allCabs: createSelector([(state: EventState) => state.cabs], (cabs) => {
      return Object.values(cabs);
    }),
  },
});

export function addObsLabels(state: EventState) {
  if (!state.obsLabels) {
    state.obsLabels = {};
  }
}

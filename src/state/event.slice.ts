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

/**
 * Settings that belong to the event as a whole rather than to any one draw
 * config: either because they state a rule the whole event plays by, or
 * because letting two configs disagree about them just produces an
 * inconsistent screen. Unlike configs, there is exactly one of these per room,
 * and it is shared with everyone connected to it.
 */
export interface EventSettings {
  /**
   * A chart drawn anywhere in this event's history can never be drawn again.
   * Enforced twice over: draws exclude used charts up front, and the reducer
   * refuses a draw that would reuse one — which is what stops two cabs drawing
   * the same chart before either has seen the other's draw.
   */
  preventChartReuse: boolean;
  hideVetos: boolean;
  showMaxScore: boolean;
  showPlayerAndRoundLabels: boolean;
}

export const defaultEventSettings: EventSettings = {
  preventChartReuse: false,
  hideVetos: false,
  showMaxScore: false,
  showPlayerAndRoundLabels: true,
};

interface EventState {
  eventName: string;
  settings: EventSettings;
  cabs: Record<string, CabInfo>;
  obsLabels: Record<string, { label: string; value: string }>;
  obsCss: string;
}

const initialState: EventState = {
  eventName: "",
  settings: defaultEventSettings,
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
    addCab: {
      // the id must be minted here rather than in the reducer: actions
      // replay on the party server and other clients, and every replica
      // has to produce an identical cab
      prepare(name: string) {
        return { payload: { name, id: nanoid(5) } };
      },
      reducer(state, action: PayloadAction<{ name: string; id: string }>) {
        state.cabs[action.payload.id] = {
          id: action.payload.id,
          name: action.payload.name,
          activeMatch: null,
        };
      },
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
    updateSettings(state, action: PayloadAction<Partial<EventSettings>>) {
      Object.assign(state.settings, action.payload);
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

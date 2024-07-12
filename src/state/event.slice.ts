import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { nanoid } from "nanoid";

interface CabInfo {
  /** drawing id if active */
  activeMatch: string | null;
  name: string;
  id: string;
}

interface EventState {
  eventName: string;
  cabs: Record<string, CabInfo>;
}

const initialState: EventState = {
  eventName: "",
  cabs: {},
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
    assignMatchToCab(
      state,
      action: PayloadAction<{ cabId: string; matchId: string | null }>,
    ) {
      const cab = state.cabs[action.payload.cabId];
      if (!cab) return;
      cab.activeMatch = action.payload.matchId;
    },
  },
});

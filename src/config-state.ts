import { atom } from "jotai";

export const showEligibleCharts = atom(false);
export const showPlayerAndRoundLabels = atom(true);

export type { ConfigState } from "./state/config.slice";

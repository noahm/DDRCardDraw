import { atom } from "jotai";

export const degrsIsTesting = atom(false);
export const degrsTestProgress = atom(0);
export const degrsTestResults = atom<number | undefined>(undefined);

export const TEST_SIZE = 10_000;
export const REPORT_FREQUENCY = TEST_SIZE / 100;

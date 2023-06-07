import { RecoilValue, atom, selector } from "recoil";
import { syncEffect } from "recoil-sync";
import { number } from "@recoiljs/refine";

export const chartCount = atom({
  key: "config/chartCount",
  default: 5,
  effects: [
    syncEffect({
      refine: number(),
    }),
  ],
});

export const levelBounds = atom<[number, number]>({
  key: "config/levelBounds",
  default: [0, 0],
});

export const useWeights = atom({
  key: "config/useWeights",
  default: false,
});

export const weights = atom<number[]>({
  key: "config/weights",
  default: [],
});

export const orderByAction = atom({
  key: "config/orderByAction",
  default: true,
});

export const forceDistribution = atom({
  key: "config/forceDistribution",
  default: true,
});

export const constrainPocketPicks = atom({
  key: "config/constrainPocketPicks",
  default: true,
});

export const style = atom({
  key: "config/style",
  default: "",
});

export const difficulties = atom<ReadonlySet<string>>({
  key: "config/difficulties",
  default: new Set(),
});

export const flags = atom<ReadonlySet<string>>({
  key: "config/flags",
  default: new Set(),
});

export const showPool = atom({
  key: "config/showPool",
  default: false,
});

export const configState = selector({
  key: "config/selector",
  get: ({ get }) => ({
    chartCount: get(chartCount),
    levelBounds: get(levelBounds),
    style: get(style),
    difficulties: get(difficulties),
    flags: get(flags),
    useWeights: get(useWeights),
    weights: get(weights),
    orderByAction: get(orderByAction),
    forceDistribution: get(forceDistribution),
    constrainPocketPicks: get(constrainPocketPicks),
  }),
});

type InnerRecoilValue<T> = T extends RecoilValue<infer U> ? U : never;

export type ConfigState = InnerRecoilValue<typeof configState>;

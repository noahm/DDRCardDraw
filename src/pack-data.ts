import { create } from "zustand";

interface PackData {
  [packName: string]: string[];
}

interface PackDataState {
  data?: PackData;
  selectedPack?: string;
}

export const usePackData = create<PackDataState>()(() => ({}));

import("./assets/packs.json").then(({ default: data }) => {
  usePackData.setState({ data });
});

export function useSelectedPack() {
  return usePackData((state) => {
    if (state.data && state.selectedPack) {
      return state.data[state.selectedPack];
    }
  });
}

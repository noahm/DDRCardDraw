import { NativeSelect } from "@mantine/core";
import { atom, useAtom } from "jotai";
import { useConfigState } from "../state/hooks";
import { useGetMetaString } from "../game-data-utils";

export const currentTabAtom = atom("all");

export function EligibleChartsListFilter() {
  const getMetaString = useGetMetaString();
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const selectedFlags = Array.from(useConfigState((cfg) => cfg.flags));

  if (!selectedFlags.length) {
    return null;
  }

  selectedFlags.unshift("all");

  return (
    <NativeSelect
      value={currentTab}
      onChange={(e) => setCurrentTab(e.currentTarget.value)}
      data={Array.from(selectedFlags).map((flag) => ({
        value: flag,
        label: flag === "all" ? "All charts" : getMetaString(flag),
      }))}
    />
  );
}

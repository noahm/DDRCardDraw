import { HTMLSelect } from "@blueprintjs/core";
import { atom, useAtom } from "jotai";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";

export const currentTabAtom = atom("all");

export function EligibleChartsListFilter() {
  const { t } = useIntl();
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const selectedFlags = Array.from(useConfigState((cfg) => cfg.flags));

  if (!selectedFlags.length) {
    return null;
  }

  selectedFlags.unshift("all");

  return (
    <HTMLSelect
      value={currentTab}
      onChange={(e) => setCurrentTab(e.currentTarget.value)}
      options={Array.from(selectedFlags).map((flag) => ({
        value: flag,
        label: flag === "all" ? "All charts" : t(`meta.${flag}`),
      }))}
    />
  );
}

import { Switch } from "@blueprintjs/core";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { shallow } from "zustand/shallow";
import styles from "./show-charts-toggle.css";

export function ShowChartsToggle({ inDrawer }: { inDrawer: boolean }) {
  const { t } = useIntl();
  const { showEligible, update } = useConfigState(
    (state) => ({
      showEligible: state.showEligibleCharts,
      update: state.update,
    }),
    shallow,
  );
  return (
    <Switch
      alignIndicator={inDrawer ? "left" : "right"}
      large
      className={styles.showAllToggle}
      label={t("showSongPool")}
      checked={showEligible}
      onChange={(e) => {
        update({
          showEligibleCharts: !!e.currentTarget.checked,
        });
      }}
    />
  );
}

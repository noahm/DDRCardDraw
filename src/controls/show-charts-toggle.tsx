import { Switch } from "@blueprintjs/core";
import { useIntl } from "../hooks/useIntl";
import styles from "./show-charts-toggle.css";
import { showEligibleCharts } from "../config-state";
import { useAtom } from "jotai";

export function ShowChartsToggle({ inDrawer }: { inDrawer: boolean }) {
  const { t } = useIntl();
  const [showEligible, setShowEligible] = useAtom(showEligibleCharts);
  return (
    <Switch
      alignIndicator={inDrawer ? "left" : "right"}
      large
      className={styles.showAllToggle}
      label={t("showSongPool")}
      checked={showEligible}
      onChange={(e) => {
        setShowEligible(!!e.currentTarget.checked);
      }}
    />
  );
}

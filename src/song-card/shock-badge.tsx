import styles from "./shock-badge.css";
import { useIntl } from "../hooks/useIntl";
import { Offline } from "@blueprintjs/icons";

export function ShockBadge() {
  const { t } = useIntl();
  return (
    <div className={styles.shockBadge}>
      <Offline title={t("controls.shockArrows")} size={14} />
    </div>
  );
}

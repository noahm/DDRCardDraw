import styles from "./shock-badge.css";
import { useIntl } from "../hooks/useIntl";
import { Icon } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";

export function ShockBadge() {
  const { t } = useIntl();
  return (
    <div className={styles.shockBadge}>
      <Icon
        icon={IconNames.OFFLINE}
        title={t("controls.shockArrows")}
        size={14}
      />
    </div>
  );
}

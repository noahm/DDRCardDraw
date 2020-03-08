import { TranslateContext } from "@denysvuika/preact-translate";
import { Zap } from "preact-feather";
import { useContext } from "preact/hooks";
import styles from "./shock-badge.css";

export function ShockBadge() {
  const { t } = useContext(TranslateContext);
  return (
    <div className={styles.shockBadge} title={t("shockArrows")}>
      <Zap size={12} aria-hidden color="black" fill="yellow" stroke-width="1" />
    </div>
  );
}

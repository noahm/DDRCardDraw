import shallow from "zustand/shallow";
import styles from "./weights.css";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox } from "@blueprintjs/core";
import { getDiffClass } from "../game-data-utils";

export function DiffLimits() {
  const { t } = useIntl();
  const { limitsPerDifficulty, difficulties, update } = useConfigState(
    (cfg) => ({
      difficulties: cfg.difficulties,
      limitsPerDifficulty: cfg.limitsPerDifficulty,
      update: cfg.update,
    }),
    shallow
  );

  function setLimit(difficulty: string, value: number) {
    update((state) => {
      const limitsPerDifficulty = new Map(state.limitsPerDifficulty);
      if (Number.isInteger(value)) {
        limitsPerDifficulty.set(difficulty, value);
      } else {
        limitsPerDifficulty.delete(difficulty);
      }
      return { limitsPerDifficulty };
    });
  }

  return (
    <section className={styles.weights}>
      <p>{t("diff-limits")}</p>
      {Array.from(difficulties.values()).map((diff) => (
        <div className={styles.level} key={diff}>
          <NumericInput
            width={2}
            value={limitsPerDifficulty.get(diff) || ""}
            min={0}
            onValueChange={(v) => setLimit(diff, v)}
            fill
          />
          {getDiffClass(t, diff)}
        </div>
      ))}
    </section>
  );
}

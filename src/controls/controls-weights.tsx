import shallow from "zustand/shallow";
import styles from "./controls-weights.module.css";
import { times } from "../utils";
import { useMemo } from "react";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox } from "@blueprintjs/core";

interface Props {
  high: number;
  low: number;
}

export function WeightsControls({ high, low }: Props) {
  const { t } = useIntl();
  const { weights, forceDistribution, updateConfig } = useConfigState(
    (cfg) => ({
      weights: cfg.weights,
      forceDistribution: cfg.forceDistribution,
      updateConfig: cfg.update,
    }),
    shallow
  );
  const levels = useMemo(
    () => times(high - low + 1, (n) => n + low - 1),
    [high, low]
  );

  function toggleForceDistribution() {
    updateConfig((state) => ({
      forceDistribution: !state.forceDistribution,
    }));
  }

  function setWeight(difficulty: number, value: number) {
    updateConfig((state) => {
      const newWeights = state.weights.slice();
      if (Number.isInteger(value)) {
        newWeights[difficulty] = value;
      } else {
        delete newWeights[difficulty];
      }
      return { weights: newWeights };
    });
  }

  const totalWeight = levels.reduce(
    (total, level) => total + (weights[level] || 0),
    0
  );
  const percentages = levels.map((level) => {
    const value = weights[level] || 0;
    return value ? ((100 * value) / totalWeight).toFixed(0) : 0;
  });

  return (
    <section className={styles.weights}>
      <p>{t("weights.explanation")}</p>
      {levels.map((level, i) => (
        <div className={styles.level} key={level}>
          <NumericInput
            width={2}
            name={`weight-${level}`}
            value={weights[level] || ""}
            min={0}
            onValueChange={(v) => setWeight(level, v)}
            placeholder="0"
            fill
          />
          {level} <sub>{percentages[i]}%</sub>
        </div>
      ))}
      <Checkbox
        label={t("weights.check.label")}
        title={t("weights.check.title")}
        name="limitOutliers"
        checked={forceDistribution}
        onChange={toggleForceDistribution}
      />
    </section>
  );
}

import styles from "./controls-weights.css";
import { times } from "../utils";
import { useMemo, useContext } from "react";
import { ConfigStateContext } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Switch, Checkbox } from "@blueprintjs/core";

interface Props {
  high: number;
  low: number;
}

export function WeightsControls({ high, low }: Props) {
  const { t } = useIntl();
  const { weights, update, forceDistribution } = useContext(ConfigStateContext);
  const levels = useMemo(
    () => times(high - low + 1, (n) => n + low - 1),
    [high, low]
  );

  function toggleForceDistribution() {
    update((state) => {
      return {
        ...state,
        forceDistribution: !state.forceDistribution,
      };
    });
  }

  function setWeight(difficulty: number, value: number) {
    update((state) => {
      const newWeights = state.weights.slice();
      if (Number.isInteger(value)) {
        newWeights[difficulty] = value;
      } else {
        delete newWeights[difficulty];
      }
      return { ...state, weights: newWeights };
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

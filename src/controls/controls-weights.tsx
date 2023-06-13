import shallow from "zustand/shallow";
import styles from "./controls-weights.css";
import { getDefault, times } from "../utils";
import { useMemo } from "react";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox } from "@blueprintjs/core";

interface Props {
  drawGroups?: string[];
  high?: number;
  low?: number;
}

export function WeightsControls({ drawGroups, high, low }: Props) {
  const { t } = useIntl();
  const { weights, forceDistribution, updateConfig } = useConfigState(
    (cfg) => ({
      weights: cfg.weights,
      forceDistribution: cfg.forceDistribution,
      updateConfig: cfg.update,
    }),
    shallow
  );
  const groups = useMemo(
    function() {
      if (drawGroups && drawGroups.length > 0) {
        return drawGroups;
      }
      else if (high && low) {
        return times(high - low + 1, (n) => n + low - 1).map((v) => v.toString());
      }
      else {
        // TODO: not sure what behavior is "typescriptiest" for an incomplete high/low pair
        return [];
      }
    },
    [drawGroups, high, low]
  );

  function toggleForceDistribution() {
    updateConfig((state) => ({
      forceDistribution: !state.forceDistribution,
    }));
  }

  function setWeight(groupIndex: number, value: number) {
    updateConfig((state) => {
      const newWeights = state.weights.slice();
      if (Number.isInteger(value)) {
        newWeights[groupIndex] = value;
      } else {
        delete newWeights[groupIndex];
      }
      return { weights: newWeights };
    });
  }

  const totalWeight = groups.reduce(
    (total, group, index) => total + (weights[index] || 0),
    0
  );
  const percentages = groups.map((group, index) => {
    const value = (weights[index] || 0);
    return value ? ((100 * value) / totalWeight).toFixed(0) : 0;
  });

  return (
    <section className={styles.weights}>
      <p>{t("weights.explanation")}</p>
      {groups.map((group, i) => (
        <div className={styles.group} key={group}>
          <NumericInput
            width={2}
            name={`weight-${group}`}
            value={weights[i] || ""}
            min={0}
            onValueChange={(v) => setWeight(i, v)}
            placeholder="0"
            fill
          />
          {group} <sub>{percentages[i]}%</sub>
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

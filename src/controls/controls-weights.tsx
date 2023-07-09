import { shallow } from "zustand/shallow";
import styles from "./controls-weights.css";
import { times } from "../utils";
import { useMemo } from "react";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox, Classes } from "@blueprintjs/core";

interface Props {
  high: number;
  low: number;
}

export function WeightsControls({ high, low }: Props) {
  const { t } = useIntl();
  const { weights, forceDistribution, groupSongsAt, updateConfig } =
    useConfigState(
      (cfg) => ({
        weights: cfg.weights,
        forceDistribution: cfg.forceDistribution,
        groupSongsAt: cfg.groupSongsAt,
        updateConfig: cfg.update,
      }),
      shallow
    );
  let levels = useMemo(
    () => times(high - low + 1, (n) => n + low - 1),
    [high, low]
  );

  function toggleForceDistribution() {
    updateConfig((state) => ({
      forceDistribution: !state.forceDistribution,
    }));
  }

  function toggleGroupCheck() {
    updateConfig((state) => {
      if (state.groupSongsAt) {
        return { groupSongsAt: null };
      }

      return { groupSongsAt: state.upperBound - 1 };
    });
  }

  function handleGroupCutoffChange(next: number) {
    if (isNaN(next)) {
      return;
    }
    if (next < low) {
      return;
    }
    updateConfig({ groupSongsAt: next });
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

  if (groupSongsAt) {
    levels = levels.filter((l) => l <= groupSongsAt);
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
      <p className={Classes.TEXT_MUTED}>{t("weights.explanation")}</p>
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
          {groupSongsAt === level && ">="}
          {level} <sub>{percentages[i]}%</sub>
        </div>
      ))}
      <Checkbox
        label={t("weights.check.label")}
        title={t("weights.check.title")}
        checked={forceDistribution}
        onChange={toggleForceDistribution}
      />
      <Checkbox
        label={t("weights.group.label")}
        title={t("weights.group.title")}
        checked={groupSongsAt !== null}
        onChange={toggleGroupCheck}
      />
      <NumericInput
        width={2}
        disabled={!groupSongsAt}
        value={groupSongsAt || high - 1}
        min={levels[0]}
        onValueChange={handleGroupCutoffChange}
        placeholder="0"
      />
    </section>
  );
}

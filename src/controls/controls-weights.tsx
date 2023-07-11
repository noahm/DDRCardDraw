import shallow from "zustand/shallow";
import styles from "./controls-weights.css";
import { times, zeroPad } from "../utils";
import { useMemo } from "react";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox, Classes } from "@blueprintjs/core";

interface Props {
  usesTiers: boolean;
  high: number;
  low: number;
}

export function WeightsControls({ usesTiers, high, low }: Props) {
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
  let groups = useMemo(
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

  if (groupSongsAt) {
    groups = groups.filter((l) => l <= groupSongsAt);
  }
  const totalWeight = groups.reduce(
    (total, group) => total + (weights[group] || 0),
    0
  );
  const percentages = groups.map((group) => {
    const value = weights[group] || 0;
    return value ? ((100 * value) / totalWeight).toFixed(0) : 0;
  });

  return (
    <section className={styles.weights}>
      <p className={Classes.TEXT_MUTED}>{t("weights.explanation")}</p>
      {groups.map((group) => (
        <div className={styles.level} key={group}>
          <NumericInput
            width={2}
            name={`weight-${group}`}
            value={weights[group] || ""}
            min={0}
            onValueChange={(v) => setWeight(group, v)}
            placeholder="0"
            fill
          />
          {groupSongsAt === group && ">="}
          {usesTiers ? `T${zeroPad(group, 2)}` : group}{" "}
          <sub>{percentages[group]}%</sub>
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
        min={low}
        onValueChange={handleGroupCutoffChange}
        placeholder="0"
      />
    </section>
  );
}

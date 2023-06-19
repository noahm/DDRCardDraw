import shallow from "zustand/shallow";
import styles from "./controls-weights.css";
import { getDefault, times } from "../utils";
import { useMemo, useState } from "react";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox } from "@blueprintjs/core";

interface Props {
  drawGroups: string[];
  high: number;
  low: number;
}

export function WeightsControls({ drawGroups, high, low }: Props) {
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
    function() {
      if (drawGroups!.length > 0) {
        return drawGroups;
      }
      else {
        return times(high - low + 1, (n) => n + low - 1).map((v) => v.toString());
      }
    },
    [drawGroups, high, low]
  );
  const [groupCutoff, setGroupCutoff] = useState(high - 1);

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

      return { groupSongsAt: groupCutoff };
    });
  }

  function handleGroupCutoffChange(next: number) {
    if (isNaN(next)) {
      return;
    }
    if (next < low) {
      return;
    }
    setGroupCutoff(next);
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

  if (!(drawGroups!.length > 0) && groupSongsAt) {
    groups = groups.filter((l) => parseInt(l) <= groupSongsAt);
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
          {!(drawGroups!.length > 0) && (groupSongsAt?.toString() == group) && ">="}
          {group} <sub>{percentages[i]}%</sub>
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
        disabled={drawGroups!.length > 0}
        checked={!(drawGroups!.length > 0) && (groupSongsAt !== null)}
        onChange={toggleGroupCheck}
      />
      <NumericInput
        width={2}
        disabled={drawGroups!.length > 0 || !groupSongsAt}
        value={groupCutoff}
        min={low}
        onValueChange={handleGroupCutoffChange}
        placeholder="0"
      />
    </section>
  );
}

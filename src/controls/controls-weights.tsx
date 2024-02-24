import { shallow } from "zustand/shallow";
import styles from "./controls-weights.css";
import { zeroPad } from "../utils";
import { useMemo } from "react";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox, Classes } from "@blueprintjs/core";
import { useDrawState } from "../draw-state";
import { getAvailableLevels } from "../game-data-utils";
import { LevelRangeBucket, getBuckets } from "../card-draw";

interface Props {
  usesTiers: boolean;
  high: number;
  low: number;
}
const pctFmt = new Intl.NumberFormat(undefined, { style: "percent" });

function printGroup(group: LevelRangeBucket | number) {
  if (typeof group === "number") {
    return group.toString();
  } else {
    return `${group[0]}-${group[1]}`;
  }
}

export function WeightsControls({ usesTiers, high, low }: Props) {
  const { t } = useIntl();
  const {
    weights,
    useWeights,
    forceDistribution,
    bucketCount,
    updateConfig,
    totalToDraw,
  } = useConfigState(
    (cfg) => ({
      useWeights: cfg.useWeights,
      weights: cfg.weights,
      forceDistribution: cfg.forceDistribution,
      bucketCount: cfg.probabilityBucketCount,
      updateConfig: cfg.update,
      totalToDraw: cfg.chartCount,
    }),
    shallow,
  );
  const gameData = useDrawState((s) => s.gameData);
  const groups = useMemo(() => {
    const availableLevels = getAvailableLevels(gameData, true);
    return getBuckets(
      {
        lowerBound: low,
        upperBound: high,
        useWeights,
        probabilityBucketCount: bucketCount,
      },
      availableLevels,
    );
  }, [useWeights, high, low, bucketCount, gameData]);

  function toggleForceDistribution() {
    updateConfig((state) => ({
      forceDistribution: !state.forceDistribution,
    }));
  }

  function toggleBucketCount() {
    updateConfig((state) => {
      if (state.probabilityBucketCount) {
        return { probabilityBucketCount: null };
      }

      return {
        probabilityBucketCount: state.upperBound - state.lowerBound + 1,
      };
    });
  }

  function handleBucketCountChange(next: number) {
    if (isNaN(next)) {
      return;
    }
    if (!bucketCount) {
      return;
    }
    updateConfig({ probabilityBucketCount: next });
  }

  function setWeight(groupIndex: number, value: number) {
    updateConfig((state) => {
      const newWeights = state.weights.slice();
      if (Number.isInteger(value)) {
        newWeights[groupIndex] = value;
      } else {
        newWeights[groupIndex] = undefined;
      }
      return { weights: newWeights };
    });
  }

  const totalWeight = groups.reduce<number>(
    (total, group, idx) => total + (weights[idx] || 0),
    0,
  );
  const percentages = groups.map((group, idx) => {
    const value = weights[idx] || 0;
    const pct = value / totalWeight;
    if (forceDistribution) {
      if (pct === 1) {
        return totalToDraw;
      }
      const max = Math.ceil(totalToDraw * pct);
      if (!max) {
        return 0;
      }
      return `${max - 1}-${max}`;
    } else {
      return pctFmt.format(isNaN(pct) ? 0 : pct);
    }
  });

  return (
    <section className={styles.weights}>
      <p className={Classes.TEXT_MUTED}>
        {forceDistribution
          ? t("weights.forcedExplanation")
          : t("weights.explanation")}
      </p>
      {groups.map((group, idx) => (
        <div className={styles.level} key={printGroup(group)}>
          <NumericInput
            type="number"
            inputMode="numeric"
            width={2}
            name={`weight-${group}`}
            value={weights[idx] || ""}
            min={0}
            onValueChange={(v) => setWeight(idx, v)}
            placeholder="0"
            fill
          />
          {/* {groupSongsAt === group && ">="} */}
          {usesTiers && typeof group === "number"
            ? `T${zeroPad(group, 2)}`
            : printGroup(group)}{" "}
          <sub>{percentages[idx]}</sub>
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
        checked={!!bucketCount}
        onChange={toggleBucketCount}
      />
      <NumericInput
        className={styles.narrow}
        type="number"
        inputMode="numeric"
        width={2}
        disabled={!bucketCount}
        value={bucketCount || high - low + 1}
        min={2}
        onValueChange={handleBucketCountChange}
      />
    </section>
  );
}

import { shallow } from "zustand/shallow";
import styles from "./controls-weights.css";
import { useMemo } from "react";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox, Classes } from "@blueprintjs/core";
import { useDrawState } from "../draw-state";
import { getDrawBuckets, planDraw } from "../draw-buckets";
import {
  printBucketBounds,
  printBucketRange,
  printBucketShare,
} from "./bucket-common";

interface Props {
  usesTiers: boolean;
}

export function WeightsControls({ usesTiers }: Props) {
  const { t } = useIntl();
  const {
    weights,
    forceDistribution,
    bucketCount,
    updateConfig,
    totalToDraw,
    useGranularLevels,
    lowerBound,
    upperBound,
  } = useConfigState(
    (cfg) => ({
      weights: cfg.weights,
      forceDistribution: cfg.forceDistribution,
      bucketCount: cfg.probabilityBucketCount,
      updateConfig: cfg.update,
      totalToDraw: cfg.chartCount,
      useGranularLevels: cfg.useGranularLevels,
      lowerBound: cfg.lowerBound,
      upperBound: cfg.upperBound,
    }),
    shallow,
  );
  const gameData = useDrawState((s) => s.gameData);
  const buckets = useMemo(
    () =>
      getDrawBuckets(
        {
          bucketMode: "auto",
          lowerBound,
          upperBound,
          probabilityBucketCount: bucketCount,
          weights,
          manualBuckets: [],
          useGranularLevels,
        },
        gameData,
      ),
    [gameData, useGranularLevels, lowerBound, upperBound, bucketCount, weights],
  );
  const plan = useMemo(
    () => planDraw(buckets, { chartCount: totalToDraw, forceDistribution }),
    [buckets, totalToDraw, forceDistribution],
  );

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
        probabilityBucketCount: Math.floor(
          state.upperBound - state.lowerBound + 1,
        ),
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

  const totalWeight = buckets.reduce((total, b) => total + b.weight, 0);
  const precisionRange = useGranularLevels
    ? gameData?.meta.granularTierResolution
    : undefined;

  return (
    <section className={styles.weights}>
      <p className={Classes.TEXT_MUTED}>
        {forceDistribution
          ? t("weights.forcedExplanation")
          : t("weights.explanation")}
      </p>
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
        value={bucketCount || Math.floor(upperBound - lowerBound + 1)}
        min={2}
        onValueChange={handleBucketCountChange}
      />
      {buckets.map((bucket, idx) => {
        const label = printBucketRange(bucket, precisionRange, usesTiers);
        const bounds = printBucketBounds(bucket, precisionRange);
        return (
          <div
            className={styles.level}
            key={bucket.key}
            title={bounds === label ? undefined : `lvl ${bounds}`}
          >
            <NumericInput
              type="number"
              inputMode="numeric"
              width={2}
              name={`weight-${label}`}
              value={weights[idx] || ""}
              min={0}
              onValueChange={(v) => setWeight(idx, v)}
              placeholder="0"
              fill
            />
            {label}{" "}
            <sub>
              {printBucketShare(
                bucket,
                plan.allocations.get(bucket.key),
                totalWeight,
                forceDistribution,
              )}
            </sub>
          </div>
        );
      })}
    </section>
  );
}

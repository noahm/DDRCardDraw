import { shallow } from "zustand/shallow";
import styles from "./controls-weights.css";
import { zeroPad } from "../utils";
import { useMemo } from "react";
import { useConfigState, useUpdateConfig } from "../state/hooks";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox, Classes } from "@blueprintjs/core";
import { getAvailableLevels } from "../game-data-utils";
import { LevelRangeBucket, getBuckets } from "../card-draw";
import { useAppState } from "../state/store";

interface Props {
  usesTiers: boolean;
  high: number;
  low: number;
}
const pctFmt = new Intl.NumberFormat(undefined, { style: "percent" });

function printGroup(
  group: LevelRangeBucket | number,
  precisionRange: number | undefined,
) {
  if (typeof group === "number") {
    return group.toString();
  } else {
    const digits = precisionRange && (1 / precisionRange).toString().length - 2;
    if (group[0] === group[1]) {
      return group[0].toFixed(digits);
    }
    return `${group[0].toFixed(digits)}-${group[1].toFixed(digits)}`;
  }
}

export function WeightsControls({ usesTiers, high, low }: Props) {
  const { t } = useIntl();
  const updateConfig = useUpdateConfig();
  const {
    weights,
    useWeights,
    forceDistribution,
    bucketCount,
    totalToDraw,
    useGranularLevels,
  } = useConfigState(
    (cfg) => ({
      useWeights: cfg.useWeights,
      weights: cfg.weights,
      forceDistribution: cfg.forceDistribution,
      bucketCount: cfg.probabilityBucketCount,
      totalToDraw: cfg.chartCount,
      useGranularLevels: cfg.useGranularLevels,
    }),
    shallow,
  );
  const gameData = useAppState((s) => s.gameData.gameData);
  const groups = useMemo(() => {
    const availableLevels = getAvailableLevels(gameData, useGranularLevels);
    return Array.from(
      getBuckets(
        {
          lowerBound: low,
          upperBound: high,
          useWeights,
          probabilityBucketCount: bucketCount,
          useGranularLevels,
        },
        availableLevels,
        gameData?.meta.granularTierResolution,
      ),
    );
  }, [gameData, useGranularLevels, low, high, useWeights, bucketCount]);

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
        value={bucketCount || Math.floor(high - low + 1)}
        min={2}
        onValueChange={handleBucketCountChange}
      />
      {groups.map((group, idx) => (
        <div
          className={styles.level}
          key={printGroup(
            group,
            useGranularLevels
              ? gameData?.meta.granularTierResolution
              : undefined,
          )}
        >
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
            : printGroup(
                group,
                useGranularLevels
                  ? gameData?.meta.granularTierResolution
                  : undefined,
              )}{" "}
          <sub>{percentages[idx]}</sub>
        </div>
      ))}
    </section>
  );
}

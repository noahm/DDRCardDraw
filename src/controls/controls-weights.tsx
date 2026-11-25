import { shallow } from "zustand/shallow";
import styles from "./controls-weights.css";
import { zeroPad } from "../utils";
import { useMemo } from "react";
import { useConfigState, useGameData, useUpdateConfig } from "../state/hooks";
import { useIntl } from "../hooks/useIntl";
import { Checkbox, NumberInput, Text } from "@mantine/core";
import { getAvailableLevels } from "../game-data-utils";
import { LevelRangeBucket, getBuckets } from "../card-draw";

interface Props {
  usesTiers: boolean;
  high: number;
  low: number;
}
const pctFmt = new Intl.NumberFormat(undefined, { style: "percent" });

/** number of digits after the decimal point in a number's string form */
function decimalDigits(n: number) {
  const decimalIndex = n.toString().indexOf(".");
  return decimalIndex === -1 ? 0 : n.toString().length - decimalIndex - 1;
}

function printGroup(
  group: LevelRangeBucket | number,
  precisionRange: number | undefined,
) {
  if (typeof group === "number") {
    return group.toString();
  } else {
    // games with a configured granular tier resolution use that to determine
    // display precision, but some games (eg SDVX) have inherently fractional
    // levels with no granular toggle, so fall back to the precision actually
    // present in the bucket bounds
    const digits = precisionRange
      ? (1 / precisionRange).toString().length - 2
      : Math.max(decimalDigits(group[0]), decimalDigits(group[1]));
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
  const gameData = useGameData();
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

  function handleBucketCountChange(next: number | string) {
    const parsed = typeof next === "string" ? parseInt(next) : next;
    if (isNaN(parsed)) {
      return;
    }
    if (!bucketCount) {
      return;
    }
    updateConfig({ probabilityBucketCount: parsed });
  }

  function setWeight(groupIndex: number, value: number | string) {
    const parsed = typeof value === "string" ? parseInt(value) : value;
    updateConfig((state) => {
      const newWeights = state.weights.slice();
      if (Number.isInteger(parsed)) {
        newWeights[groupIndex] = parsed;
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
  const percentages = groups.map((_group, idx) => {
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
      <Text c="dimmed" component="p">
        {forceDistribution
          ? t("weights.forcedExplanation")
          : t("weights.explanation")}
      </Text>
      <Checkbox
        label={t("weights.check.label")}
        title={t("weights.check.title")}
        my={4}
        checked={forceDistribution}
        onChange={toggleForceDistribution}
      />
      <Checkbox
        label={t("weights.group.label")}
        title={t("weights.group.title")}
        my={4}
        checked={!!bucketCount}
        onChange={toggleBucketCount}
      />
      <NumberInput
        className={styles.narrow}
        inputMode="numeric"
        hideControls
        disabled={!bucketCount}
        value={bucketCount || Math.floor(high - low + 1)}
        min={2}
        onChange={handleBucketCountChange}
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
          <NumberInput
            inputMode="numeric"
            hideControls
            name={`weight-${printGroup(group, useGranularLevels ? gameData?.meta.granularTierResolution : undefined)}`}
            value={weights[idx] || ""}
            min={0}
            onChange={(v) => setWeight(idx, v)}
            placeholder="0"
          />
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

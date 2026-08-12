import {
  Button,
  Callout,
  Checkbox,
  Classes,
  NumericInput,
} from "@blueprintjs/core";
import { Cross, Plus } from "@blueprintjs/icons";
import { useMemo } from "react";
import { useConfigState } from "../config-state";
import { countChartsPerBucket } from "../card-draw";
import {
  ManualBucket,
  findOverlappingBuckets,
  getDrawBuckets,
  makeManualBucket,
  planDraw,
} from "../draw-buckets";
import { useDrawState } from "../draw-state";
import { getAvailableLevels } from "../game-data-utils";
import { useIntl } from "../hooks/useIntl";
import { printBucketRange, printBucketShare } from "./bucket-common";
import styles from "./controls-buckets.css";

interface Props {
  usesTiers: boolean;
}

export function ManualBucketControls({ usesTiers }: Props) {
  const { t } = useIntl();
  const config = useConfigState();
  const {
    manualBuckets,
    forceDistribution,
    chartCount,
    useGranularLevels,
    update: updateConfig,
  } = config;
  const gameData = useDrawState((s) => s.gameData);

  const availableLvls = useMemo(
    () => getAvailableLevels(gameData, useGranularLevels),
    [gameData, useGranularLevels],
  );
  const buckets = useMemo(
    () => getDrawBuckets(config, gameData),
    [config, gameData],
  );
  const plan = useMemo(
    () => planDraw(buckets, { chartCount, forceDistribution }),
    [buckets, chartCount, forceDistribution],
  );
  const chartCounts = useMemo(
    () =>
      gameData
        ? countChartsPerBucket(config, gameData, buckets)
        : new Map<string, number>(),
    [config, gameData, buckets],
  );
  const overlaps = useMemo(
    () => findOverlappingBuckets(manualBuckets),
    [manualBuckets],
  );

  const minLvl = availableLvls[0] ?? 1;
  const maxLvl = availableLvls[availableLvls.length - 1] ?? 20;
  // read the increment off the data rather than off `granularTierResolution`:
  // some games (eg SDVX) have inherently fractional lvls with no granular
  // toggle, and stepping those by a whole lvl skips most of the usable range
  const stepSize = useMemo(() => {
    let smallest = 1;
    for (let i = 1; i < availableLvls.length; i++) {
      const gap = availableLvls[i] - availableLvls[i - 1];
      if (gap > 0 && gap < smallest) {
        smallest = gap;
      }
    }
    // guard against float noise in the source data (18.1 - 18 !== 0.1)
    return Math.round(smallest * 1000) / 1000;
  }, [availableLvls]);
  const precisionRange = useGranularLevels
    ? gameData?.meta.granularTierResolution
    : undefined;
  const totalWeight = buckets.reduce((sum, b) => sum + b.weight, 0);

  /**
   * Pulls a bound onto a lvl the game actually has. Buckets match on a plain
   * range, so an off-lvl bound isn't wrong, but it makes the bucket's real
   * extent hard to read and accumulates float noise as you step through.
   */
  function snapToAvailableLvl(value: number) {
    let closest = value;
    let closestDistance = Infinity;
    for (const lvl of availableLvls) {
      const distance = Math.abs(lvl - value);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = lvl;
      }
    }
    return closest;
  }

  function patchBucket(key: string, patch: Partial<ManualBucket>) {
    updateConfig((state) => ({
      manualBuckets: state.manualBuckets.map((bucket) =>
        bucket.key === key ? { ...bucket, ...patch } : bucket,
      ),
    }));
  }

  function removeBucket(key: string) {
    updateConfig((state) => ({
      manualBuckets: state.manualBuckets.filter((bucket) => bucket.key !== key),
    }));
  }

  function addBucket() {
    updateConfig((state) => {
      const last = state.manualBuckets[state.manualBuckets.length - 1];
      // start the new bucket just past wherever the last one left off
      const nextLvlIdx = last ? availableLvls.indexOf(last.high) + 1 : 0;
      const low =
        nextLvlIdx > 0 && nextLvlIdx < availableLvls.length
          ? availableLvls[nextLvlIdx]
          : Math.min(last ? last.high : minLvl, maxLvl);
      return {
        manualBuckets: state.manualBuckets.concat(makeManualBucket(low, low)),
      };
    });
  }

  return (
    <section className={styles.buckets}>
      <p className={Classes.TEXT_MUTED}>{t("buckets.explanation")}</p>
      <Checkbox
        label={t("weights.check.label")}
        title={t("weights.check.title")}
        checked={forceDistribution}
        onChange={() =>
          updateConfig((state) => ({
            forceDistribution: !state.forceDistribution,
          }))
        }
      />
      {!!manualBuckets.length && (
        <div className={`${styles.bucketRow} ${styles.headerRow}`}>
          <div>{t("buckets.from")}</div>
          <div />
          <div>{t("buckets.to")}</div>
          <div>{t("buckets.weight")}</div>
          <div />
          <div />
        </div>
      )}
      {buckets.map((bucket) => {
        const poolSize = chartCounts.get(bucket.key) || 0;
        const invalid = bucket.low > bucket.high;
        return (
          <div className={styles.bucketRow} key={bucket.key}>
            <NumericInput
              type="number"
              inputMode="decimal"
              fill
              buttonPosition="none"
              value={bucket.low}
              min={minLvl}
              max={maxLvl}
              stepSize={stepSize}
              minorStepSize={null}
              intent={invalid ? "danger" : undefined}
              onValueChange={(low) =>
                !isNaN(low) && patchBucket(bucket.key, { low })
              }
              onBlur={() =>
                patchBucket(bucket.key, {
                  low: snapToAvailableLvl(bucket.low),
                })
              }
            />
            <div className={styles.separator}>–</div>
            <NumericInput
              type="number"
              inputMode="decimal"
              fill
              buttonPosition="none"
              value={bucket.high}
              min={minLvl}
              max={maxLvl}
              stepSize={stepSize}
              minorStepSize={null}
              intent={invalid ? "danger" : undefined}
              onValueChange={(high) =>
                !isNaN(high) && patchBucket(bucket.key, { high })
              }
              onBlur={() =>
                patchBucket(bucket.key, {
                  high: snapToAvailableLvl(bucket.high),
                })
              }
            />
            <NumericInput
              type="number"
              inputMode="numeric"
              fill
              buttonPosition="none"
              value={bucket.weight}
              min={0}
              placeholder="0"
              onValueChange={(weight) =>
                !isNaN(weight) && patchBucket(bucket.key, { weight })
              }
            />
            <div
              className={`${styles.summary} ${poolSize ? "" : styles.emptyBucket}`}
              title={printBucketRange(bucket, precisionRange, usesTiers)}
            >
              <span className={styles.share}>
                {printBucketShare(
                  bucket,
                  plan.allocations.get(bucket.key),
                  totalWeight,
                  forceDistribution,
                )}
              </span>{" "}
              {t("buckets.poolSize", { count: poolSize })}
            </div>
            <Button
              variant="minimal"
              icon={<Cross />}
              aria-label={t("buckets.remove")}
              title={t("buckets.remove")}
              onClick={() => removeBucket(bucket.key)}
            />
          </div>
        );
      })}
      <Button icon={<Plus />} onClick={addBucket}>
        {t("buckets.add")}
      </Button>
      {!manualBuckets.length && (
        <Callout intent="warning" style={{ marginTop: "0.5em" }}>
          {t("buckets.emptyWarning")}
        </Callout>
      )}
      {!!overlaps.length && (
        <Callout intent="warning" style={{ marginTop: "0.5em" }}>
          {t("buckets.overlapWarning", {
            ranges: overlaps
              .map(
                ([a, b]) =>
                  `${printBucketRange(a, precisionRange, usesTiers)} / ${printBucketRange(b, precisionRange, usesTiers)}`,
              )
              .join(", "),
          })}
        </Callout>
      )}
    </section>
  );
}

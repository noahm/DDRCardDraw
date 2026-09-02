import {
  Button,
  Callout,
  Checkbox,
  Classes,
  NumericInput,
} from "@blueprintjs/core";
import { Cross, Plus } from "@blueprintjs/icons";
import { useMemo } from "react";
import { countChartsPerBucket } from "../card-draw";
import {
  ManualBucket,
  findOverlappingBuckets,
  getDrawBuckets,
  makeManualBucket,
  planDraw,
  topOfWholeLvl,
} from "../draw-buckets";
import { getAvailableLevels } from "../game-data-utils";
import { useConfigState, useGameData, useUpdateConfig } from "../state/hooks";
import { useIntl } from "../hooks/useIntl";
import { printBucketRange, printBucketShare } from "./bucket-common";
import { NudgableLvlInput } from "./nudgable-lvl-input";
import styles from "./controls-buckets.css";

interface Props {
  usesTiers: boolean;
}

export function ManualBucketControls({ usesTiers }: Props) {
  const { t } = useIntl();
  const config = useConfigState();
  const { manualBuckets, forceDistribution, chartCount, useGranularLevels } =
    config;
  const gameData = useGameData();
  const updateConfig = useUpdateConfig();

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

  const precisionRange = useGranularLevels
    ? gameData?.meta.granularTierResolution
    : undefined;
  const totalWeight = buckets.reduce((sum, b) => sum + b.weight, 0);

  /**
   * The lvls each end of a bucket can step to. Stepping stays inside the
   * bucket, so the buttons can never invert it — typing still can, and that
   * shows up as an invalid row.
   */
  function neighborsFor(bucket: ManualBucket) {
    const lowIdx = availableLvls.indexOf(bucket.low);
    const highIdx = availableLvls.indexOf(bucket.high);
    const after = (idx: number) =>
      idx === -1 ? undefined : availableLvls[idx + 1];
    const before = (idx: number) =>
      idx <= 0 ? undefined : availableLvls[idx - 1];
    const lowNext = after(lowIdx);
    const highPrev = before(highIdx);
    return {
      lowValid: lowIdx !== -1,
      highValid: highIdx !== -1,
      lowPrev: before(lowIdx),
      lowNext:
        lowNext !== undefined && lowNext <= bucket.high ? lowNext : undefined,
      highPrev:
        highPrev !== undefined && highPrev >= bucket.low ? highPrev : undefined,
      highNext: after(highIdx),
    };
  }

  /** mirrors the main lvl range: only lvls the game actually has get committed */
  function setBound(bucket: ManualBucket, edge: "low" | "high", value: number) {
    if (!availableLvls.includes(value)) {
      return;
    }
    const clamped =
      edge === "low"
        ? Math.min(value, bucket.high)
        : Math.max(value, bucket.low);
    patchBucket(bucket.key, { [edge]: clamped });
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
          : (last?.high ?? availableLvls[0]);
      if (low === undefined) {
        return {};
      }
      // span the rest of whatever whole lvl we landed on, so a fresh bucket
      // holds a useful number of charts in granular mode too
      return {
        manualBuckets: state.manualBuckets.concat(
          makeManualBucket(low, topOfWholeLvl(Math.floor(low), availableLvls)),
        ),
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
      <div className={styles.bucketTable}>
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
          const neighbors = neighborsFor(bucket);
          return (
            <div className={styles.bucketRow} key={bucket.key}>
              <NudgableLvlInput
                value={bucket.low}
                isValid={neighbors.lowValid && !invalid}
                prevValue={neighbors.lowPrev}
                nextValue={neighbors.lowNext}
                aria-label={t("buckets.from")}
                size="small"
                inputSize={5}
                onChange={(next) => setBound(bucket, "low", next)}
              />
              <div className={styles.separator}>–</div>
              <NudgableLvlInput
                value={bucket.high}
                isValid={neighbors.highValid && !invalid}
                prevValue={neighbors.highPrev}
                nextValue={neighbors.highNext}
                aria-label={t("buckets.to")}
                size="small"
                inputSize={5}
                onChange={(next) => setBound(bucket, "high", next)}
              />
              <NumericInput
                type="number"
                inputMode="numeric"
                fill
                size="small"
                buttonPosition="none"
                aria-label={t("buckets.weight")}
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
      </div>
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

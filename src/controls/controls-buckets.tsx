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
import { useIntl } from "../hooks/useIntl";
import { formatLvl, getLvlBands, stepLvl } from "../lvl-display";
import { printBucketShare } from "./bucket-common";
import { LvlBoundInput } from "./lvl-bound-input";
import styles from "./controls-buckets.css";

export function ManualBucketControls() {
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

  const bands = useMemo(
    () => getLvlBands(gameData, useGranularLevels),
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

  const totalWeight = buckets.reduce((sum, b) => sum + b.weight, 0);

  /** a bucket's span in the game's own lvl notation, eg "13 - 13+" */
  function describeRange(bucket: { low: number; high: number }) {
    const low = formatLvl(bands, bucket.low);
    const high = formatLvl(bands, bucket.high);
    return low === high ? low : `${low} - ${high}`;
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
      // open the new bucket on the lvl just past wherever the last one ended,
      // falling back to the bottom of the range when there's nowhere left to go
      const next = last ? stepLvl(bands, last.high, 1) : bands[0];
      const band = next || bands[bands.length - 1];
      if (!band) {
        return {};
      }
      return {
        manualBuckets: state.manualBuckets.concat(
          makeManualBucket(band.low, band.high),
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
            <LvlBoundInput
              bands={bands}
              value={bucket.low}
              edge="low"
              aria-label={t("buckets.from")}
              intent={invalid ? "danger" : undefined}
              onChange={(low) => patchBucket(bucket.key, { low })}
            />
            <div className={styles.separator}>–</div>
            <LvlBoundInput
              bands={bands}
              value={bucket.high}
              edge="high"
              aria-label={t("buckets.to")}
              intent={invalid ? "danger" : undefined}
              onChange={(high) => patchBucket(bucket.key, { high })}
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
              title={describeRange(bucket)}
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
              .map(([a, b]) => `${describeRange(a)} / ${describeRange(b)}`)
              .join(", "),
          })}
        </Callout>
      )}
    </section>
  );
}

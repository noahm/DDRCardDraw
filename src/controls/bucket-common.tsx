import { zeroPad } from "../utils";
import type { BucketAllocation, DrawBucket } from "../draw-buckets";

const pctFmt = new Intl.NumberFormat(undefined, { style: "percent" });

/** number of digits after the decimal point in a number's string form */
function decimalDigits(n: number) {
  const decimalIndex = n.toString().indexOf(".");
  return decimalIndex === -1 ? 0 : n.toString().length - decimalIndex - 1;
}

/**
 * @param precisionRange the game's granular tier resolution, when granular
 * levels are in use
 */
export function printBucketRange(
  bucket: Pick<DrawBucket, "low" | "high" | "wholeLvl">,
  precisionRange: number | undefined,
  usesTiers = false,
) {
  if (bucket.wholeLvl !== undefined) {
    return usesTiers
      ? `T${zeroPad(bucket.wholeLvl, 2)}`
      : bucket.wholeLvl.toString();
  }
  // games with a configured granular tier resolution use that to determine
  // display precision, but some games (eg SDVX) have inherently fractional
  // levels with no granular toggle, so fall back to the precision actually
  // present in the bucket bounds
  const digits = precisionRange
    ? (1 / precisionRange).toString().length - 2
    : Math.max(decimalDigits(bucket.low), decimalDigits(bucket.high));
  if (bucket.low === bucket.high) {
    return bucket.low.toFixed(digits);
  }
  return `${bucket.low.toFixed(digits)}-${bucket.high.toFixed(digits)}`;
}

/**
 * The literal bounds of a bucket, ignoring the whole-lvl shorthand. A bucket
 * labelled "18" covers 18.0-18.9 on a game with fractional lvls, which is worth
 * spelling out somewhere even when the compact label is what gets rendered.
 */
export function printBucketBounds(
  bucket: Pick<DrawBucket, "low" | "high">,
  precisionRange: number | undefined,
) {
  return printBucketRange(
    { low: bucket.low, high: bucket.high },
    precisionRange,
  );
}

/**
 * Describes what a bucket contributes to a drawing. Reads straight off the
 * allocation the draw itself will run, so the preview can't drift from the
 * actual behavior.
 */
export function printBucketShare(
  bucket: DrawBucket,
  allocation: BucketAllocation | undefined,
  totalWeight: number,
  forceDistribution: boolean,
) {
  if (!bucket.weight || !allocation) {
    return "0";
  }
  if (forceDistribution) {
    return allocation.min === allocation.max
      ? allocation.max.toString()
      : `${allocation.min}-${allocation.max}`;
  }
  return pctFmt.format(totalWeight ? bucket.weight / totalWeight : 0);
}

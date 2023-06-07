import styles from "./controls-weights.css";
import { times } from "../utils";
import { useMemo } from "react";
import {
  weights as weightsAtom,
  forceDistribution as forceDistAtom,
  levelBounds,
  useWeights as useWeightsAtom,
} from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { NumericInput, Checkbox } from "@blueprintjs/core";
import { useRecoilState, useRecoilValue } from "recoil";

export function WeightsControls() {
  const { t } = useIntl();
  const [useWeights, setUseWeights] = useRecoilState(useWeightsAtom);
  return (
    <>
      <Checkbox
        id="weighted"
        checked={useWeights}
        onChange={(e) => {
          setUseWeights(!!e.currentTarget.checked);
        }}
        label={t("useWeightedDistributions")}
      />
      {useWeights && <WeightsDetails />}
    </>
  );
}

function WeightsDetails() {
  const { t } = useIntl();
  const [weights, setWeights] = useRecoilState(weightsAtom);
  const [forceDistribution, setForceDist] = useRecoilState(forceDistAtom);
  const [low, high] = useRecoilValue(levelBounds);
  const levels = useMemo(
    () => times(high - low + 1, (n) => n + low - 1),
    [high, low]
  );

  function toggleForceDistribution() {
    setForceDist((prev) => !prev);
  }

  function setWeight(difficulty: number, value: number) {
    setWeights((prev) => {
      const newWeights = prev.slice();
      if (Number.isInteger(value)) {
        newWeights[difficulty] = value;
      } else {
        delete newWeights[difficulty];
      }
      return newWeights;
    });
  }

  const totalWeight = levels.reduce(
    (total, level) => total + (weights[level] || 0),
    0
  );
  const percentages = levels.map((level) => {
    const value = weights[level] || 0;
    return value ? ((100 * value) / totalWeight).toFixed(0) : 0;
  });

  return (
    <section className={styles.weights}>
      <p>{t("weights.explanation")}</p>
      {levels.map((level, i) => (
        <div className={styles.level} key={level}>
          <NumericInput
            width={2}
            name={`weight-${level}`}
            value={weights[level] || ""}
            min={0}
            onValueChange={(v) => setWeight(level, v)}
            placeholder="0"
            fill
          />
          {level} <sub>{percentages[i]}%</sub>
        </div>
      ))}
      <Checkbox
        label={t("weights.check.label")}
        title={t("weights.check.title")}
        name="limitOutliers"
        checked={forceDistribution}
        onChange={toggleForceDistribution}
      />
    </section>
  );
}

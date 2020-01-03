import { Component } from "preact";
import styles from "./controls-weights.css";
import { times } from "./utils";
import { TranslateContext } from "@denysvuika/preact-translate";
import { useState, useMemo, useContext } from "preact/hooks";
import { UncontrolledCheckbox } from "./uncontrolled";

interface Props {
  hidden: boolean;
  high: number;
  low: number;
}

export class WeightsControls extends Component<Props> {
  render() {
    const { hidden, high, low } = this.props;

    const { t } = useContext(TranslateContext);
    const levels = useMemo(() => times(high - low + 1, n => n + low - 1), [
      high,
      low
    ]);

    const [savedWeights, updateWeights] = useState(() => {
      const newWeights: Array<number | ""> = [];
      for (const level of levels) {
        newWeights[level] = 1;
      }
      return newWeights;
    });
    function setWeight(difficulty: number, value: number) {
      const newWeights = savedWeights.slice();
      newWeights[difficulty] = Number.isInteger(value) ? value : "";
      updateWeights(newWeights);
    }

    const totalWeight = levels.reduce(
      (total, level) => total + (savedWeights[level] || 0),
      0
    );
    const percentages = levels.map(level => {
      const value = savedWeights[level] || 0;
      return value ? ((100 * value) / totalWeight).toFixed(0) : 0;
    });

    return (
      <section className={hidden ? styles.hidden : styles.weights}>
        <p>{t("weights.explanation")}</p>
        {levels.map((level, i) => (
          <label key={level}>
            <input
              type="number"
              name={`weight-${level}`}
              value={savedWeights[level]}
              min="0"
              onChange={e => setWeight(level, +e.currentTarget.value)}
            />
            {level} <sub>{percentages[i]}%</sub>
          </label>
        ))}
        <label title={t("weights.check.title")}>
          <UncontrolledCheckbox
            type="checkbox"
            name="limitOutliers"
            defaultChecked
          />
          {t("weights.check.label")}
        </label>
      </section>
    );
  }
}

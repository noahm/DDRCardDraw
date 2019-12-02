import { Component } from "preact";
import styles from "./controls-weights.css";
import { times } from "./utils";
import { TranslateContext } from "@denysvuika/preact-translate";
import { useState, useMemo, useContext } from "preact/hooks";

/**
 *
 * @param {{ high: number, low: number }} props
 * @param {Array<{ label: string, value: number }> | undefined} weightState
 */
function getWeightsFor(props, state = []) {
  return times(props.high - props.low + 1, n => ({
    label: n + props.low - 1,
    value: state[n - 1] ? state[n - 1].value : 1
  }));
}

export class WeightsControls extends Component {
  render(props) {
    const [savedWeights, updateWeights] = useState([]);
    function setWeight(difficulty, value) {
      const newWeights = savedWeights.slice();
      newWeights[difficulty] = value;
      updateWeights(newWeights);
    }
    const levels = useMemo(
      () => times(props.high - props.low + 1, n => n + props.low - 1),
      [props.high, props.low]
    );
    const { t } = useContext(TranslateContext);

    const { hidden } = props;

    const totalWeight = levels.reduce(
      (total, level) => total + (savedWeights[level] || 1),
      0
    );
    const percentages = levels.map(level => {
      const value = savedWeights[level] || 1;
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
              value={savedWeights[level] || 1}
              min="0"
              onChange={e => setWeight(level, +e.currentTarget.value)}
            />
            {level} <sub>{percentages[i]}%</sub>
          </label>
        ))}
        <label title={t("weights.check.title")}>
          <input type="checkbox" name="limitOutliers" defaultChecked={true} />
          {t("weights.check.label")}
        </label>
      </section>
    );
  }
}

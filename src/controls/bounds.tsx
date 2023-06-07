import { useRecoilState } from "recoil";
import { levelBounds } from "../config-state";
import styles from "./controls.css";
import { FormGroup, NumericInput } from "@blueprintjs/core";
import { useDrawState } from "../draw-state";

export function Bounds() {
  const [[lowerBound, upperBound], setBounds] = useRecoilState(levelBounds);
  const lvlMax = useDrawState((s) => s.gameData?.meta.lvlMax);

  const handleLowerBoundChange = (newLow: number) => {
    if (newLow !== lowerBound && !isNaN(newLow)) {
      if (newLow > upperBound) {
        newLow = upperBound;
      }
      setBounds((prev) => [newLow, prev[1]]);
    }
  };
  const handleUpperBoundChange = (newHigh: number) => {
    if (newHigh !== upperBound && !isNaN(newHigh)) {
      setBounds((prev) => [prev[0], newHigh]);
    }
  };
  return (
    <>
      <FormGroup label="Lvl Min" contentClassName={styles.narrowInput}>
        <NumericInput
          fill
          value={lowerBound}
          min={1}
          max={Math.max(upperBound, lowerBound, 1)}
          clampValueOnBlur
          large
          onValueChange={handleLowerBoundChange}
        />
      </FormGroup>
      <FormGroup label="Lvl Max" contentClassName={styles.narrowInput}>
        <NumericInput
          fill
          value={upperBound}
          min={lowerBound}
          max={lvlMax}
          clampValueOnBlur
          large
          onValueChange={handleUpperBoundChange}
        />
      </FormGroup>
    </>
  );
}

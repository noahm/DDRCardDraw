import { FormGroup, NumericInput } from "@blueprintjs/core";
import { chartCount as chartCountAtom } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { useRecoilState } from "recoil";
import styles from "./controls.css";

export function ChartCount() {
  const { t } = useIntl();
  const [chartCount, setChartCount] = useRecoilState(chartCountAtom);
  return (
    <FormGroup label={t("chartCount")} contentClassName={styles.narrowInput}>
      <NumericInput
        large
        fill
        value={chartCount}
        min={1}
        clampValueOnBlur
        onValueChange={(chartCount) => {
          if (!isNaN(chartCount)) {
            setChartCount(chartCount);
          }
        }}
      />
    </FormGroup>
  );
}

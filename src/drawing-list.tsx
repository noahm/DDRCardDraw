import { lazy, memo, useDeferredValue } from "react";
import styles from "./drawing-list.css";
import { useDrawState } from "./draw-state";
import { useConfigState } from "./config-state";
import { Callout, NonIdealState } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import logo from "./assets/rednote.png";

const EligibleChartsList = lazy(() => import("./eligible-charts"));
const DrawnSet = lazy(() => import("./drawn-set"));

const ScrollableDrawings = memo(() => {
  const drawings = useDeferredValue(useDrawState((s) => s.drawings));
  return (
    <div>
      {drawings.map((d) => (
        <DrawnSet key={d.id} drawing={d} />
      ))}
    </div>
  );
});

export function DrawingList() {
  const hasDrawings = useDeferredValue(
    useDrawState((s) => !!s.drawings.length)
  );
  const showPool = useDeferredValue(useConfigState((cfg) => cfg.showPool));
  if (showPool) {
    return <EligibleChartsList />;
  }
  if (!hasDrawings) {
    return (
      <div className={styles.empty}>
        <NonIdealState
          icon={<img src={logo} height={128} />}
          title="Red Note SMX Card Draw"
          action={
            <Callout intent="danger" icon={IconNames.ArrowTopLeft}>
              Choose a tournament round, then click 'Draw'
            </Callout>
          }
        />
      </div>
    );
  }
  return <ScrollableDrawings />;
}

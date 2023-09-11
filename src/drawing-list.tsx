import {
  Suspense,
  lazy,
  memo,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import styles from "./drawing-list.css";
import { useDrawState } from "./draw-state";
import { useConfigState } from "./config-state";
import { Callout, NonIdealState, Spinner } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import logo from "./assets/ddr-tools-256.png";

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
    useDrawState((s) => !!s.drawings.length),
  );
  const showEligible = useDeferredValue(
    useConfigState((cfg) => cfg.showEligibleCharts),
  );
  if (showEligible) {
    return (
      <Suspense fallback={<DelayedSpinner />}>
        <EligibleChartsList />
      </Suspense>
    );
  }
  if (!hasDrawings) {
    return (
      <div className={styles.empty}>
        <NonIdealState
          icon={<img src={logo} height={128} />}
          title="DDR Tools"
          description="Click 'Draw' above to draw some songs at random. Chose from other games in the top left menu."
          action={
            <Callout intent="primary" icon={IconNames.ThirdParty}>
              Networking features now available! Start with the new tab in
              settings.
            </Callout>
          }
        />
      </div>
    );
  }
  return (
    <Suspense fallback={<DelayedSpinner />}>
      <ScrollableDrawings />
    </Suspense>
  );
}

function DelayedSpinner(props: { timeout?: number }) {
  const [show, updateShow] = useState(false);
  useEffect(() => {
    if (show) return;

    const timeout = setTimeout(() => {
      updateShow(true);
    }, props.timeout || 250);
    return () => clearTimeout(timeout);
  }, [props.timeout, show]);
  if (show) {
    return <Spinner style={{ marginTop: "15px" }} />;
  }
  return null;
}

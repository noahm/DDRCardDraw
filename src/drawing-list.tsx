import {
  Suspense,
  lazy,
  memo,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import styles from "./drawing-list.css";
import { Callout, NonIdealState, Spinner } from "@blueprintjs/core";
import { Import } from "@blueprintjs/icons";
import logo from "./assets/ddr-tools-256.png";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./utils/error-fallback";
import { useAppState } from "./state/store";
import { useAtomValue } from "jotai";
import { showEligibleCharts } from "./config-state";
import { drawingsSlice } from "./state/drawings.slice";

const EligibleChartsList = lazy(() => import("./eligible-charts"));
const DrawnSet = lazy(() => import("./drawn-set"));

const ScrollableDrawings = memo(() => {
  const drawingIds = useDeferredValue(useAppState((s) => s.drawings.ids));
  return (
    <div style={{ height: "100%", flex: "1 1 auto", overflowY: "auto" }}>
      {drawingIds
        .map((did) => <DrawnSet key={did} drawingId={did} />)
        .reverse()}
    </div>
  );
});

export function DrawingList() {
  const hasDrawings = useDeferredValue(
    useAppState(drawingsSlice.selectors.haveDrawings),
  );
  const showEligible = useDeferredValue(useAtomValue(showEligibleCharts));
  if (showEligible) {
    return (
      <ErrorBoundary fallback={<ErrorFallback />}>
        <Suspense fallback={<DelayedSpinner />}>
          <EligibleChartsList />
        </Suspense>
      </ErrorBoundary>
    );
  }
  if (!hasDrawings) {
    return (
      <div className={styles.empty}>
        <NonIdealState
          icon={<img src={logo} height={128} width={128} alt="" />}
          title="DDR Tools"
          description="Click 'Draw' above to draw some songs at random. Chose from other games in the top left menu."
          action={
            <Callout intent="primary" icon={<Import />}>
              Instant local pack imports are now available! Drag and drop a pack
              folder onto this page to get started.
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

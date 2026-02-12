import React, { Suspense, lazy, memo, useDeferredValue } from "react";
import styles from "./drawing-list.css";
import { Callout, NonIdealState } from "@blueprintjs/core";
import { WarningSign } from "@blueprintjs/icons";
import logo from "./assets/ddr-tools-256.png";
import { useAppState } from "./state/store";
import { drawingsSlice } from "./state/drawings.slice";
import { DelayedSpinner } from "./common-components/delayed-spinner";
import { useIntl } from "./hooks/useIntl";
import { FormattedMessage } from "react-intl";

const DrawnSetGroup = lazy(() => import("./drawn-set-group"));

const ScrollableDrawings = memo(() => {
  const drawingIds = useDeferredValue(useAppState((s) => s.drawings.ids));
  return (
    <div style={{ height: "100%", flex: "1 1 auto", overflowY: "auto" }}>
      {drawingIds
        .map((drawingId) => (
          <DrawnSetGroup key={drawingId} drawingId={drawingId} />
        ))
        .reverse()}
    </div>
  );
});

export function DrawingList(props: { introString?: React.ReactNode }) {
  const { t } = useIntl();
  const hasDrawings = useDeferredValue(
    useAppState(drawingsSlice.selectors.haveDrawings),
  );
  if (!hasDrawings) {
    return (
      <div className={styles.empty}>
        <NonIdealState
          icon={<img src={logo} height={128} width={128} alt="" />}
          title="DDR Tools"
          description={props.introString || t("hero.description")}
          action={
            <Callout intent="warning" icon={<WarningSign />}>
              <FormattedMessage id="hero.callout" />
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

import { Suspense, lazy, memo, useDeferredValue } from "react";
import styles from "./drawing-list.css";
import { Callout, NonIdealState } from "@blueprintjs/core";
import { Import } from "@blueprintjs/icons";
import logo from "./assets/ddr-tools-256.png";
import { useAppState } from "./state/store";
import { drawingsSlice } from "./state/drawings.slice";
import { DelayedSpinner } from "./common-components/delayed-spinner";
import { useIntl } from "./hooks/useIntl";
import { FormattedMessage } from "react-intl";

const DrawnSetGroup = lazy(() => import("./drawn-set-group"));

const ScrollableDrawings = memo(() => {
  const drawingIds = useDeferredValue(useAppState((s) => s.drawingGroups.ids));
  return (
    <div style={{ height: "100%", flex: "1 1 auto", overflowY: "auto" }}>
      {drawingIds
        .map((groupId) => (
          <DrawnSetGroup key={groupId} drawingGroupId={groupId} />
        ))
        .reverse()}
    </div>
  );
});

export function DrawingList() {
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
          description={t("hero.description")}
          action={
            <Callout intent="primary" icon={<Import />}>
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

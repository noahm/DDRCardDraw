import { useContext, memo } from "react";
import { DrawnSet } from "./drawn-set";
import styles from "./drawing-list.css";
import { DrawStateContext } from "./draw-state";
import { Drawing } from "./models/Drawing";
import { ConfigStateContext } from "./config-state";
import { EligibleChartsList } from "./eligible-charts-list";
import { Callout, NonIdealState } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import logo from "./assets/ddr-tools-256.png";

const renderDrawing = (drawing: Drawing) => (
  <DrawnSet key={drawing.id} drawing={drawing} />
);

const ScrollableDrawings = memo((props: { drawings: Drawing[] }) => {
  return (
    <div className={styles.scrollable}>{props.drawings.map(renderDrawing)}</div>
  );
});

export function DrawingList() {
  const { drawings } = useContext(DrawStateContext);
  const configState = useContext(ConfigStateContext);
  if (configState.showPool) {
    return <EligibleChartsList />;
  }
  if (!drawings.length) {
    return (
      <div className={styles.empty}>
        <NonIdealState
          icon={<img src={logo} height={128} />}
          title="DDR Tools"
          description="Click 'Draw' above to draw some songs at random. Chose from other games in the top left menu."
          action={
            <Callout intent="primary" icon={IconNames.ENDORSED}>
              DDR Card Draw now has a new name and and URL. Look out for even
              more new features coming soon!
            </Callout>
          }
        />
      </div>
    );
  }
  return <ScrollableDrawings drawings={drawings} />;
}

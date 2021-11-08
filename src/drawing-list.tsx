import { useContext, memo } from "react";
import { DrawnSet } from "./drawn-set";
import styles from "./drawing-list.css";
import { DrawStateContext } from "./draw-state";
import { Drawing } from "./models/Drawing";
import { ConfigStateContext } from "./config-state";
import { EligibleChartsList } from "./eligible-charts-list";

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
  return <ScrollableDrawings drawings={drawings} />;
}

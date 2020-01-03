import { useContext } from "preact/hooks";
import { DrawnSet } from "./drawn-set";
import styles from "./drawing-list.css";
import { DrawStateContext } from "./draw-state";
import { Drawing } from "./models/Drawing";

const renderDrawing = (drawing: Drawing) => (
  <DrawnSet key={drawing.id} drawing={drawing} />
);

function renderScrollableDrawings(drawings: Drawing[]) {
  return <div className={styles.scrollable}>{drawings.map(renderDrawing)}</div>;
}

export function DrawingList() {
  const { drawings } = useContext(DrawStateContext);
  return renderScrollableDrawings(drawings);
}

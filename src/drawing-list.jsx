import { useContext } from "preact/hooks";
import { DrawnSet } from "./drawn-set";
import styles from "./drawing-list.css";
import { DrawStateContext } from "./draw-state";

const renderDrawing = drawing => (
  <DrawnSet key={drawing.id} drawing={drawing} />
);

function renderScrollableDrawings(drawings) {
  return <div className={styles.scrollable}>{drawings.map(renderDrawing)}</div>;
}

export function DrawingList() {
  const { drawings } = useContext(DrawStateContext);
  return renderScrollableDrawings(drawings);
}

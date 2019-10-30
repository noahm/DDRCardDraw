import { useContext } from "preact/hooks";
import { DrawnSet } from "./drawn-set";
import styles from "./drawing-list.css";
import { TOURNAMENT_MODE } from "./utils";
import { DrawStateContext } from "./draw-state";

const renderDrawing = drawing => (
  <DrawnSet key={drawing.id} drawing={drawing} />
);

function renderScrollableDrawings(drawings) {
  return <div className={styles.scrollable}>{drawings.map(renderDrawing)}</div>;
}

export function DrawingList() {
  const { drawings } = useContext(DrawStateContext);
  if (!TOURNAMENT_MODE) {
    return renderScrollableDrawings(drawings);
  }

  const [nextSet, currentSet, ...pastSets] = drawings;

  return (
    <div className={styles.drawings}>
      {(nextSet || currentSet) && (
        <section>
          <div className={styles.sectionLabel}>Current Set:</div>
          {renderDrawing(currentSet || nextSet)}
        </section>
      )}
      {!!nextSet && !!currentSet && (
        <section>
          <div className={styles.sectionLabel}>Up Next:</div>
          {renderDrawing(nextSet)}
        </section>
      )}
      {!!pastSets.length && (
        <section className={styles.drawings}>
          <div className={styles.sectionLabel}>Past sets:</div>
          {renderScrollableDrawings(pastSets)}
        </section>
      )}
    </div>
  );
}

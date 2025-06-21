import { DrawingProvider } from "./drawing-context";
import DrawnSet from "./drawn-set";
import { useRotatingGradientStyles } from "./hooks/useRotatingGradient";
import { useAppState } from "./state/store";
import { MatchLabels } from "./tournament-mode/drawing-labels";
import styles from "./drawn-set-group.css";

export default function DrawnSetGroup(props: { drawingId: string }) {
  const gradient = useRotatingGradientStyles();
  const drawing = useAppState((s) => s.drawings.entities[props.drawingId]);
  if (!drawing) return null;
  return (
    <div style={{ ...gradient }} className={styles.drawnSetGroup}>
      <DrawingProvider drawingId={props.drawingId}>
        <MatchLabels />
        <DrawnSet />
        {drawing.subDrawings &&
          Object.values(drawing.subDrawings).map((subDraw) => (
            <DrawingProvider
              key={subDraw.id}
              drawingId={subDraw.parentId}
              subDrawId={subDraw.id}
            >
              <DrawnSet />
            </DrawingProvider>
          ))}
      </DrawingProvider>
    </div>
  );
}

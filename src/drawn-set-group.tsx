import { DrawingProvider } from "./drawing-context";
import DrawnSet from "./drawn-set";
import { useRotatingGradientStyles } from "./hooks/useRotatingGradient";
import { useAppState } from "./state/store";
import { MatchLabels } from "./tournament-mode/drawing-labels";
import styles from "./drawn-set-group.css";

export default function DrawnSetGroup({ drawingId }: { drawingId: string }) {
  const gradient = useRotatingGradientStyles();
  const drawing = useAppState((s) => s.drawings.entities[drawingId]);
  if (!drawing) return null;
  return (
    <div style={{ ...gradient }} className={styles.drawnSetGroup}>
      {drawing.subDrawings &&
        Object.values(drawing.subDrawings).map((subDraw, idx) => (
          <DrawingProvider key={subDraw.id} drawingId={subDraw.compoundId}>
            {idx === 0 && <MatchLabels />}
            <DrawnSet />
          </DrawingProvider>
        ))}
    </div>
  );
}

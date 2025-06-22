import { DrawingProvider } from "./drawing-context";
import DrawnSet, { ChartList } from "./drawn-set";
import { useRotatingGradientStyles } from "./hooks/useRotatingGradient";
import { useAppState } from "./state/store";
import { MatchLabels } from "./tournament-mode/drawing-labels";
import styles from "./drawn-set-group.css";
import { MatchActions } from "./tournament-mode/drawing-actions";

export default function DrawnSetGroup({ drawingId }: { drawingId: string }) {
  const gradient = useRotatingGradientStyles();
  const drawing = useAppState((s) => s.drawings.entities[drawingId]);
  if (!drawing) return null;
  return (
    <div style={{ ...gradient }} className={styles.drawnSetGroup}>
      {drawing.subDrawings &&
        Object.values(drawing.subDrawings).map((subDraw, idx) => (
          <DrawingProvider
            key={subDraw.compoundId[1]}
            drawingId={subDraw.compoundId}
          >
            {idx === 0 && <MatchLabels />}
            <DrawnSet />
          </DrawingProvider>
        ))}
      <MatchActions drawingId={drawingId} />
    </div>
  );
}

export function PlainDrawnSetGroup({ drawingId }: { drawingId: string }) {
  const drawing = useAppState((s) => s.drawings.entities[drawingId]);
  if (!drawing) return null;
  return (
    <div>
      {drawing.subDrawings &&
        Object.values(drawing.subDrawings).map((subDraw) => (
          <DrawingProvider
            key={subDraw.compoundId[1]}
            drawingId={subDraw.compoundId}
          >
            <ChartList />
          </DrawingProvider>
        ))}
    </div>
  );
}

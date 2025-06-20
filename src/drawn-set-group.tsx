import { DrawingProvider } from "./drawing-context";
import DrawnSet from "./drawn-set";
import { useAppState } from "./state/store";
import { SetLabels } from "./tournament-mode/drawing-labels";

export default function DrawnSetGroup(props: { drawingId: string }) {
  const drawing = useAppState((s) => s.drawings.entities[props.drawingId]);
  return (
    <div>
      <DrawingProvider drawingId={props.drawingId}>
        <SetLabels />
        <DrawnSet />
        {drawing.subDrawings &&
          drawing.subDrawings.map((subDraw) => (
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

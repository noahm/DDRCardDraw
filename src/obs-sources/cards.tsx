import { useParams } from "react-router-dom";
import { ChartList } from "../drawn-set";
import { useAppState } from "../state/store";
import { DrawingProvider } from "../drawing-context";
import { PlainDrawnSetGroup } from "../drawn-set-group";
/**
 * @todo figure out how/if we can assign/view sub-draws here?
 */
export function CabCards() {
  const params = useParams<"roomName" | "cabId">();
  const drawingId = useAppState((s) => s.event.cabs[params.cabId!].activeMatch);
  if (!drawingId) {
    return null;
  }
  if (typeof drawingId === "string") {
    return <PlainDrawnSetGroup drawingId={drawingId} />;
  }
  return (
    <DrawingProvider drawingId={drawingId}>
      <ChartList />
    </DrawingProvider>
  );
}

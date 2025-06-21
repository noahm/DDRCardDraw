import { useParams } from "react-router-dom";
import { ChartList } from "../drawn-set";
import { useAppState } from "../state/store";
import { DrawingProvider } from "../drawing-context";
/**
 * @todo figure out how/if we can assign/view sub-draws here?
 */
export function CabCards() {
  const params = useParams<"roomName" | "cabId">();
  const drawingId = useAppState((s) => s.event.cabs[params.cabId!].activeMatch);
  if (!drawingId) {
    return null;
  }
  return (
    <DrawingProvider drawingId={drawingId}>
      <ChartList />
    </DrawingProvider>
  );
}

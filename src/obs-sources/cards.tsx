import { useParams } from "react-router-dom";
import { ChartsOnly } from "../drawn-set";
import { useAppState } from "../state/store";
import { DrawingProvider } from "../drawing-context";

export function CabCards() {
  const params = useParams<"roomName" | "cabId">();
  const drawingId = useAppState((s) => s.event.cabs[params.cabId!].activeMatch);
  if (!drawingId) {
    return null;
  }
  return (
    <DrawingProvider drawingId={drawingId}>
      <ChartsOnly />
    </DrawingProvider>
  );
}

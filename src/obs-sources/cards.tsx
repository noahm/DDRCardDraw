import { useParams } from "react-router-dom";
import { ChartsOnly } from "../drawn-set";
import { useAppState } from "../state/store";

export function CabCards() {
  const params = useParams<"roomName" | "cabId">();
  const drawingId = useAppState((s) => s.event.cabs[params.cabId!].activeMatch);
  if (!drawingId) {
    return null;
  }
  return <ChartsOnly drawingId={drawingId} />;
}

import { useParams } from "react-router-dom";
import { drawingSelectors } from "../state/drawings.slice";
import { useAppState } from "../state/store";

export function CabTitle() {
  const params = useParams<"roomName" | "cabId">();
  const text = useAppState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    return drawingSelectors.selectById(s, drawingId).title;
  });
  return <h1>{text}</h1>;
}

export function CabPlayer(props: { p: number }) {
  const params = useParams<"roomName" | "cabId">();
  const text = useAppState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    return drawingSelectors.selectById(s, drawingId).players[props.p - 1];
  });
  return <h1>{text}</h1>;
}

import { useParams } from "react-router-dom";
import { drawingSelectors } from "../state/drawings.slice";
import { useAppState } from "../state/store";
import { playerNameByIndex } from "../models/Drawing";

export function CabTitle() {
  const params = useParams<"roomName" | "cabId">();
  const text = useAppState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    return drawingSelectors.selectById(s, drawingId).meta.title;
  });
  return <h1>{text}</h1>;
}

export function CabPlayer(props: { p: number }) {
  const params = useParams<"roomName" | "cabId">();
  const text = useAppState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const drawing = drawingSelectors.selectById(s, drawingId);
    const playerIndex = drawing.playerDisplayOrder[props.p - 1];
    const name = playerNameByIndex(drawing.meta, playerIndex, "");
    const score = Object.values(drawing.winners).reduce<number>(
      (prev, curr) => {
        if (curr === playerIndex) return prev + 1;
        return prev;
      },
      0,
    );
    return `${name} (${score})`;
  });
  return <h1>{text}</h1>;
}

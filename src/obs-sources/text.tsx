import { useParams } from "react-router-dom";
import { drawingsSlice } from "../state/drawings.slice";
import { useAppState } from "../state/store";
import { getAllPlayers, playerNameByIndex } from "../models/Drawing";

export function CabTitle() {
  const params = useParams<"roomName" | "cabId">();
  const text = useAppState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const [parent] = drawingsSlice.selectors.byCompoundOrPlainId(s, drawingId);
    if (!parent) return null;
    return parent.meta.title;
  });
  return <h1>{text}</h1>;
}

export function CabPlayers() {
  const params = useParams<"roomName" | "cabId">();
  const text = useAppState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const [parent] = drawingsSlice.selectors.byCompoundOrPlainId(s, drawingId);
    if (!parent) return null;
    return getAllPlayers(parent).join(", ");
  });
  return <h1>{text}</h1>;
}

export function CabPlayer(props: {
  p: number;
  displayType?: "NameAndScore" | "Name" | "Score";
}) {
  const { displayType = "NameAndScore " } = props;
  const params = useParams<"roomName" | "cabId">();
  const text = useAppState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const [parent] = drawingsSlice.selectors.byCompoundOrPlainId(s, drawingId);
    if (!parent) return null;
    const playerIndex = parent.playerDisplayOrder[props.p - 1];
    const name = playerNameByIndex(parent.meta, playerIndex, "");
    const hideWins =
      parent.meta.type === "startgg" && parent.meta.subtype === "gauntlet";
    if (hideWins) {
      return name;
    }
    const score = Object.values(parent.winners).reduce<number>((prev, curr) => {
      if (curr === playerIndex) return prev + 1;
      return prev;
    }, 0);
    if (displayType === "Name") {
      return name;
    }
    if (displayType === "Score") {
      return score;
    }
    return `${name} (${score})`;
  });
  return <h1>{text}</h1>;
}

export function PhaseName() {
  const params = useParams<"roomName" | "cabId">();
  const text = useAppState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const [parent] = drawingsSlice.selectors.byCompoundOrPlainId(s, drawingId);
    if (!parent) return null;
    return parent.meta.type === "startgg" ? parent.meta.phaseName : null;
  });

  return <h1>{text}</h1>;
}

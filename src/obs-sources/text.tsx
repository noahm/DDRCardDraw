import { useParams } from "react-router-dom";
import { useRoomState } from "../jazz/app-state-context";
import { getAllPlayers, playerNameByIndex } from "../models/Drawing";

export function GlobalLabel() {
  const params = useParams<"roomName" | "labelId">();
  const text = useRoomState((s) => {
    if (!params.labelId) return null;
    const label = s.event.obsLabels[params.labelId];
    if (!label) return null;
    return label.value;
  });
  return <h1>{text}</h1>;
}

export function CabTitle() {
  const params = useParams<"roomName" | "cabId">();
  const text = useRoomState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const parent = typeof drawingId === "string" ? s.drawings.entities[drawingId] : s.drawings.entities[drawingId[0]];
    if (!parent) return null;
    return parent.meta.title;
  });
  return <h1>{text}</h1>;
}

export function CabPlayers() {
  const params = useParams<"roomName" | "cabId">();
  const text = useRoomState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const parent = typeof drawingId === "string" ? s.drawings.entities[drawingId] : s.drawings.entities[drawingId[0]];
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
  const text = useRoomState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const parent = typeof drawingId === "string" ? s.drawings.entities[drawingId] : s.drawings.entities[drawingId[0]];
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
  const text = useRoomState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const parent = typeof drawingId === "string" ? s.drawings.entities[drawingId] : s.drawings.entities[drawingId[0]];
    if (!parent) return null;
    return parent.meta.type === "startgg" ? parent.meta.phaseName : null;
  });

  return <h1>{text}</h1>;
}

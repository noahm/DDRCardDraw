import { useParams } from "react-router-dom";
import { drawingsSlice } from "../state/drawings.slice";
import { useAppState } from "../state/store";
import {
  getAllPlayers,
  isExternalMeta,
  isGauntletMeta,
} from "../models/Drawing";
import { defaultPlayerFields, PlayerField } from "./player-fields";

export function GlobalLabel() {
  const params = useParams<"roomName" | "labelId">();
  const text = useAppState((s) => {
    if (!params.labelId) return null;
    const label = s.event.obsLabels[params.labelId];
    if (!label) return null;
    return label.value;
  });
  return <h1>{text}</h1>;
}

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

export function CabPlayer(props: { p: number; fields?: PlayerField[] }) {
  const fields = props.fields || defaultPlayerFields;
  const params = useParams<"roomName" | "cabId">();
  const text = useAppState((s) => {
    const drawingId = s.event.cabs[params.cabId!].activeMatch;
    if (!drawingId) return null;
    const [parent] = drawingsSlice.selectors.byCompoundOrPlainId(s, drawingId);
    if (!parent) return null;
    const player = parent.meta.players[props.p - 1];
    // a source aimed past the end of the match shows nothing at all, the same
    // as a cab with no match on it
    if (!player) return null;
    const values = fields
      .map((field): string => {
        switch (field) {
          case "name":
            return player.name || "";
          // only players drawn from start.gg carry pronouns, and only when
          // they've published them, so this one is often meant to be empty
          case "pronouns":
            return player.pronouns || "";
          case "score": {
            // a gauntlet doesn't show wins at all
            if (isGauntletMeta(parent.meta)) return "";
            const wins = Object.values(parent.winners).reduce<number>(
              (total, winner) => (winner === player.id ? total + 1 : total),
              0,
            );
            return wins.toString();
          }
        }
      })
      .filter(Boolean);
    // the first value leads and every one after it trails in parens, which
    // keeps the long-standing "Name (3)" shape and reads right for the rest
    return values.map((value, i) => (i ? `(${value})` : value)).join(" ");
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
    return isExternalMeta(parent.meta) ? parent.meta.phaseName : null;
  });

  return <h1>{text}</h1>;
}

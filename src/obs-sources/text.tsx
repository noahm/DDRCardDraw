import { useParams } from "react-router-dom";
import { drawingsSlice } from "../state/drawings.slice";
import { useAppState } from "../state/store";
import { getAllPlayers, isExternalMeta } from "../models/Drawing";
import { playerScores } from "../models/gauntlet-standings";
import { useEventSettings } from "../state/hooks";
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
  const eventScheme = useEventSettings((s) => s.gauntletPayout);
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
          // per-chart wins in a head to head match, points earned so far in a
          // gauntlet, and nothing at all in a gauntlet nobody has scored yet
          case "score": {
            const score = playerScores(parent, eventScheme)?.get(player.id);
            return score === undefined ? "" : score.toString();
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

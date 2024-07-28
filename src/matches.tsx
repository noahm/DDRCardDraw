import { Classes, Label, Text } from "@blueprintjs/core";
import { useAtom } from "jotai";
import { useCallback } from "react";
import { startggKeyAtom, startggEventSlug, getEventSets } from "./startgg-gql";
import { AppState, useAppDispatch, useAppState } from "./state/store";
import { setsSlice, Slot, TournamentSet } from "./state/matches.slice";
import { entrantsSlice } from "./state/entrants.slice";

export function MatchListAndSettings() {
  const sets = useAppState(setsSlice.selectors.selectAll);
  return sets.length ? (
    <>
      {sets.map((set) => (
        <TournamentSetPreview set={set} key={set.id} />
      ))}
    </>
  ) : (
    <StartggSetImport />
  );
}

function TournamentSetPreview(props: { set: TournamentSet }) {
  const [slot1, slot2] = props.set.slots;
  const getPlayerForSlot = (slot: Slot) => (s: AppState) => {
    if (slot.type === "player")
      return entrantsSlice.selectors.selectById(s, slot.playerId);
    const prereqSet = setsSlice.selectors.selectById(s, slot.setId);
    if (prereqSet.winningPlayerId) {
      return entrantsSlice.selectors.selectById(s, prereqSet.winningPlayerId);
    }
    return null;
  };
  const player1 = useAppState(getPlayerForSlot(slot1));
  const player2 = useAppState(getPlayerForSlot(slot2));
  return (
    <Text tagName="p">
      <strong>{props.set.roundText}</strong> -{" "}
      {player1?.startggTag || <em>TBD</em>} vs{" "}
      {player2?.startggTag || <em>TBD</em>}
    </Text>
  );
}

function StartggSetImport() {
  const [apiKey, setApiKey] = useAtom(startggKeyAtom);
  const [eventSlug, setEventSlug] = useAtom(startggEventSlug);
  const dispatch = useAppDispatch();
  const importEntrants = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!apiKey || !eventSlug) {
        return;
      }
      const sets = await getEventSets(eventSlug);
      dispatch(setsSlice.actions.upsertMany(sets));
    },
    [dispatch, apiKey, eventSlug],
  );
  return (
    <form onSubmit={importEntrants}>
      <Text tagName="p">No sets added yet, import from start.gg</Text>
      <Label>
        start.gg api key{" "}
        <input
          value={apiKey || ""}
          onChange={(e) => setApiKey(e.currentTarget.value)}
          className={Classes.INPUT}
        />
      </Label>
      <Label>
        event url
        <input
          value={eventSlug || ""}
          onChange={(e) => setEventSlug(e.currentTarget.value)}
          className={Classes.INPUT}
        />
      </Label>
      <button type="submit">Import Sets</button>
    </form>
  );
}

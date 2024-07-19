import { Classes, Label, Text } from "@blueprintjs/core";
import { useAtom } from "jotai";
import { useCallback } from "react";
import { startggKeyAtom, startggEventSlug } from "./controls/player-names";
import { getEventSets } from "./startgg-gql";
import { useAppDispatch, useAppState } from "./state/store";
import { setsSlice, TournamentSet } from "./state/matches.slice";
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
  const players = useAppState((s) =>
    entrantsSlice.selectors.selectFromIds(s, props.set.playerIds),
  );
  return (
    <Text tagName="p">
      <strong>{props.set.roundText}</strong> - {players[0]?.startggTag} vs{" "}
      {players[1]?.startggTag || <em>???</em>}
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
      const sets = await getEventSets(apiKey, eventSlug);
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

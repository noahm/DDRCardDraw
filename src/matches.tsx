import { Button, Card, Classes, Label, Spinner, Text } from "@blueprintjs/core";
import { useAtom } from "jotai";
import { ReactNode, useCallback, useRef } from "react";
import {
  startggKeyAtom,
  startggEventSlug,
  getEventSets,
  useStartggMatches,
} from "./startgg-gql";
import { AppState, useAppDispatch, useAppState } from "./state/store";
import { setsSlice, Slot, TournamentSet } from "./state/matches.slice";
import { entrantsSlice } from "./state/entrants.slice";
import { inferShortname } from "./controls/player-names";
import { Refresh } from "@blueprintjs/icons";
import { drawingsSlice } from "./state/drawings.slice";

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

export interface PickedMatch {
  title: string;
  players: Array<{ id: string; name: string }>;
  id: string;
}

export function MatchPicker(props: { onPickMatch?(match: PickedMatch): void }) {
  const [resp, refetch] = useStartggMatches();
  const existingMatches = useAppState(
    drawingsSlice.selectors.associatedMatchIds,
  );
  const matches = resp.data?.event?.sets?.nodes;
  const reloadButton = (
    <Button
      icon={resp.fetching ? <Spinner size={20} /> : <Refresh size={20} />}
      onClick={() => refetch({ requestPolicy: "network-only" })}
    />
  );
  if (!matches) {
    if (resp.fetching) {
      return (
        <div>
          <Card>
            <p className={Classes.SKELETON}>loading content for a match</p>
          </Card>
          <Card>
            <p className={Classes.SKELETON}>loading content for a match</p>
          </Card>
          <Card>
            <p className={Classes.SKELETON}>loading content for a match</p>
          </Card>
        </div>
      );
    } else {
      return <div>couldn't get a response for matches</div>;
    }
  }
  if (!matches.length)
    return <div>{reloadButton} no un-settled matches found</div>;

  return (
    <div>
      {reloadButton}
      {matches
        .filter((m) => !!m)
        .map((match) => {
          const title = match.fullRoundText || "???";
          const p1 = inferShortname(match.slots![0]?.entrant?.name);
          const p2 = inferShortname(match.slots![1]?.entrant?.name);
          const matchUsed = existingMatches.includes(match.id!);
          return (
            <Card
              key={match.id!}
              interactive={!matchUsed}
              style={{
                opacity: matchUsed ? 0.5 : undefined,
              }}
              compact
              onClick={
                matchUsed
                  ? undefined
                  : () =>
                      props.onPickMatch?.({
                        title,
                        players: match.slots!.map((slot) => ({
                          id: slot!.entrant!.id!,
                          name: inferShortname(slot!.entrant!.name)!,
                        })),
                        id: match.id!,
                      })
              }
            >
              <Text tagName="p">
                <strong>{title}</strong> - {p1 || <em>TBD</em>} vs{" "}
                {p2 || <em>TBD</em>}
              </Text>
            </Card>
          );
        })}
    </div>
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

export function StartggApiKeyGated(props: { children: ReactNode }) {
  const [apiKey, setApiKey] = useAtom(startggKeyAtom);
  const [eventSlug, setEventSlug] = useAtom(startggEventSlug);
  const apikeyRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const saveKey = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!apikeyRef.current || !slugRef.current) return;
      setApiKey(apikeyRef.current.value);
      setEventSlug(slugRef.current.value);
    },
    [setApiKey, setEventSlug],
  );
  if (apiKey && eventSlug) {
    return props.children;
  }
  return (
    <form onSubmit={saveKey}>
      <Text tagName="p">Start.gg info needed</Text>
      <Label>
        start.gg api key (
        <a target="_blank" href="https://start.gg/admin/profile/developer">
          create a personal token here
        </a>
        ){" "}
        <input
          defaultValue={apiKey || undefined}
          ref={apikeyRef}
          className={Classes.INPUT}
        />
      </Label>
      <Label>
        event url slug (in the form of:{" "}
        <pre style={{ display: "inline" }}>
          tournament/SOMETHING/event/SOMETHING
        </pre>
        )
        <input
          defaultValue={eventSlug || undefined}
          ref={slugRef}
          className={Classes.INPUT}
        />
      </Label>
      <button type="submit">Save</button>
    </form>
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

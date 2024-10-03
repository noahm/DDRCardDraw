import { Button, Card, Classes, Spinner, Text } from "@blueprintjs/core";
import { useStartggMatches } from "./startgg-gql";
import { createAppSelector, useAppState } from "./state/store";
import { inferShortname } from "./controls/player-names";
import { Refresh } from "@blueprintjs/icons";

export interface PickedMatch {
  title: string;
  players: Array<{ id: string; name: string }>;
  id: string;
}

const associatedMatchIds = createAppSelector(
  [(s) => s.drawings.entities],
  (entities) => {
    return Object.values(entities)
      .map((drawing) => drawing.meta.type === "startgg" && drawing.meta.id)
      .filter((value): value is string => typeof value === "string" && !!value);
  },
);

export function MatchPicker(props: { onPickMatch?(match: PickedMatch): void }) {
  const [resp, refetch] = useStartggMatches();
  const existingMatches = useAppState(associatedMatchIds);
  const event = resp.data?.event;
  const matches = event?.sets?.nodes;
  const reloadButton = (
    <Button
      icon={resp.fetching ? <Spinner size={20} /> : <Refresh size={20} />}
      onClick={() => refetch({ requestPolicy: "network-only" })}
    />
  );
  if (!event) {
    return (
      <div>
        {reloadButton} startgg didn't have an event for the current slug
      </div>
    );
  }
  if (!matches) {
    if (resp.fetching) {
      return (
        <div>
          {reloadButton}
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
      return <div>{reloadButton} startgg didn't respond matches</div>;
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

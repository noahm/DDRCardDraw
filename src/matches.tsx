import { Button, Card, Classes, Spinner, Text } from "@blueprintjs/core";
import { useStartggMatches, useStartggPhases } from "./startgg-gql";
import { createAppSelector, useAppState } from "./state/store";
import { inferShortname } from "./controls/player-names";
import { Refresh } from "@blueprintjs/icons";

export interface PickedMatch {
  title: string;
  players: Array<{ id: string; name: string }>;
  id: string;
  subtype: "versus" | "gauntlet";
  phaseName: string;
}

const associatedMatchIds = createAppSelector(
  [(s) => s.drawings.entities],
  (entities) => {
    return Object.values(entities).flatMap((drawing) => {
      if (drawing.meta.type === "startgg") return drawing.meta.id;
      return [];
    });
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
          const titlePieces: string[] = [match.fullRoundText || "???"];
          if ((match.phaseGroup?.phase?.groupCount || 0) > 1) {
            titlePieces.unshift(`Group ${match.phaseGroup?.displayIdentifier}`);
          }
          if (match.phaseGroup?.phase?.name) {
            titlePieces.unshift(match.phaseGroup.phase.name);
          }
          const title = titlePieces.join(" - ");

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
                        subtype: "versus",
                        phaseName: match.phaseGroup?.phase?.name || "",
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

export function GauntletPicker(props: {
  onPickMatch?(match: PickedMatch): void;
}) {
  const [resp, refetch] = useStartggPhases();
  const existingMatches = useAppState(associatedMatchIds);
  const event = resp.data?.event;
  const phases = event?.phases?.filter(
    (p) => p?.bracketType === "CUSTOM_SCHEDULE",
  );
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
  if (!phases) {
    if (resp.fetching) {
      return (
        <div>
          {reloadButton}
          <Card>
            <p className={Classes.SKELETON}>loading content for a gauntlet</p>
          </Card>
          <Card>
            <p className={Classes.SKELETON}>loading content for a gauntlet</p>
          </Card>
          <Card>
            <p className={Classes.SKELETON}>loading content for a gauntlet</p>
          </Card>
        </div>
      );
    } else {
      return <div>{reloadButton} startgg didn't respond with phases</div>;
    }
  }
  if (!phases.length)
    return <div>{reloadButton} no phases with custom schedule found</div>;

  return (
    <div>
      {reloadButton}
      {phases
        .filter((p) => !!p)
        .map((phase) => {
          const title = phase.name || "???";
          const entrants =
            phase.seeds?.nodes?.flatMap((seed) => {
              if (
                !seed ||
                !seed.entrant ||
                !seed.entrant.name ||
                !seed.entrant.id
              ) {
                return [];
              }
              return {
                name: inferShortname(seed.entrant.name),
                id: seed.entrant.id,
              };
            }) || [];
          const matchUsed = existingMatches.includes(phase.id!);
          return (
            <Card
              key={phase.id!}
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
                        players: entrants,
                        id: phase.id!,
                        subtype: "gauntlet",
                        phaseName: phase.name || "",
                      })
              }
            >
              <Text tagName="p">
                <strong>{title}</strong> (
                {entrants.map((e) => e.name).join(", ")})
              </Text>
            </Card>
          );
        })}
    </div>
  );
}

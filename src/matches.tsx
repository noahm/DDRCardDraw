import { ActionIcon, Card, Loader, Skeleton, Text } from "@mantine/core";
import { useStartggMatches, useStartggPhases } from "./startgg-gql";
import { createAppSelector, useAppState } from "./state/store";
import { inferShortname } from "./controls/player-names";
import { IconRefresh } from "@tabler/icons-react";

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

function LoadingCard({ children }: { children: string }) {
  return (
    <Card withBorder my="xs">
      <Skeleton>
        <p>{children}</p>
      </Skeleton>
    </Card>
  );
}

export function MatchPicker(props: { onPickMatch?(match: PickedMatch): void }) {
  const [resp, refetch] = useStartggMatches();
  const existingMatches = useAppState(associatedMatchIds);
  const event = resp.data?.event;
  const matches = event?.sets?.nodes;
  const reloadButton = (
    <ActionIcon
      variant="default"
      size={36}
      aria-label="Refresh"
      onClick={() => refetch({ requestPolicy: "network-only" })}
    >
      {resp.fetching ? <Loader size={20} /> : <IconRefresh size={20} />}
    </ActionIcon>
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
          <LoadingCard>loading content for a match</LoadingCard>
          <LoadingCard>loading content for a match</LoadingCard>
          <LoadingCard>loading content for a match</LoadingCard>
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
              withBorder
              my="xs"
              padding="sm"
              style={{
                opacity: matchUsed ? 0.5 : undefined,
                cursor: matchUsed ? undefined : "pointer",
              }}
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
              <Text component="p" my={0}>
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
    <ActionIcon
      variant="default"
      size={36}
      aria-label="Refresh"
      onClick={() => refetch({ requestPolicy: "network-only" })}
    >
      {resp.fetching ? <Loader size={20} /> : <IconRefresh size={20} />}
    </ActionIcon>
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
          <LoadingCard>loading content for a gauntlet</LoadingCard>
          <LoadingCard>loading content for a gauntlet</LoadingCard>
          <LoadingCard>loading content for a gauntlet</LoadingCard>
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
              withBorder
              my="xs"
              padding="sm"
              style={{
                opacity: matchUsed ? 0.5 : undefined,
                cursor: matchUsed ? undefined : "pointer",
              }}
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
              <Text component="p" my={0}>
                <strong>{title}</strong> (
                {entrants.map((e) => e.name).join(", ")})
              </Text>
            </Card>
          );
        })}
    </div>
  );
}

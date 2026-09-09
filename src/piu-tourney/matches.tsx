import { Button, Card, Classes, Spinner, Text } from "@blueprintjs/core";
import { Refresh } from "@blueprintjs/icons";
import { useIntl } from "../hooks/useIntl";
import { associatedMatchIds, PickedMatch } from "../matches";
import { useAppState } from "../state/store";
import { PiuTourneyHeader } from "./components";
import { PiuMatch, usePiuMatches, usePiuTourney, usePiuTourneyId } from ".";
import type { TourneyType } from "./database.types";

/**
 * A tourney-maker round holds every entrant of a gauntlet, or the two sides of
 * a bracket match. Gauntlet-format tournaments only ever produce the former;
 * elsewhere we go by headcount, so an oversized round still scores sanely.
 */
function isGauntlet(match: PiuMatch, tourneyType: TourneyType | null) {
  return tourneyType === "Gauntlet" || match.player_rounds.length > 2;
}

/**
 * Round names come in two shapes. Bracket rounds are named by
 * `formatRoundName` as "<label>: <p1> vs. <p2>", where the tail repeats player
 * names we already render separately. Tournaments that name their own rounds
 * use the colon differently — "Round 2: Losers B (Purple)" — and there the tail
 * is the only thing telling two rounds apart.
 *
 * So the tail is dropped only when it actually looks like the player names
 * `formatRoundName` appends; otherwise the name is kept whole.
 */
function matchLabel(name: string) {
  const split = name.indexOf(": ");
  if (split === -1) return name;
  const tail = name.slice(split + 2);
  const isPlayerList = tail.includes(" vs. ") || tail.endsWith(" (Bye)");
  return isPlayerList ? name.slice(0, split) : name;
}

function matchTitle(match: PiuMatch) {
  const label = matchLabel(match.name);
  const phase = match.round_pools?.name;
  return [phase, label]
    .filter((piece, i, all) => !!piece && all.indexOf(piece) === i)
    .join(" - ");
}

/** unordered entrants sort last, then by insertion order, as tourney-maker does */
function entrantOrder(entrant: PiuMatch["player_rounds"][number]) {
  return entrant.sort_order ?? Number.MAX_SAFE_INTEGER;
}

function matchPlayers(match: PiuMatch) {
  return [...match.player_rounds]
    .sort((a, b) => entrantOrder(a) - entrantOrder(b) || a.id - b.id)
    .map((entrant) => ({
      id: String(entrant.player_tourney_id),
      // tourney-maker names carry no sponsor prefix, so no inferShortname here
      name: entrant.player_tourneys?.player_name ?? "",
    }));
}

export function PiuMatchPicker(props: {
  onPickMatch?(match: PickedMatch): void;
}) {
  const { t } = useIntl();
  const tourneyId = usePiuTourneyId();
  const [tourney] = usePiuTourney(tourneyId);
  const [resp, refetch] = usePiuMatches(tourneyId);
  const existingMatches = useAppState(associatedMatchIds);

  const reloadButton = (
    <Button
      icon={resp.fetching ? <Spinner size={20} /> : <Refresh size={20} />}
      onClick={refetch}
    />
  );

  const header = (
    <>
      <PiuTourneyHeader />
      {reloadButton}
    </>
  );

  if (resp.error) {
    return (
      <div>
        {header} {resp.error}
      </div>
    );
  }
  if (!resp.data) {
    return (
      <div>
        {header}
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <p className={Classes.SKELETON}>loading content for a match</p>
          </Card>
        ))}
      </div>
    );
  }
  // A round with fewer than two entrants is a bye, or a slot the bracket hasn't
  // decided yet. Drawing for one produces a set nobody can play, so it's left
  // out entirely rather than listed as an option that can't be taken.
  const drawable = resp.data.filter((m) => m.player_rounds.length >= 2);

  if (!drawable.length) {
    return (
      <div>
        {header}{" "}
        {resp.data.length
          ? t(
              "piuTourney.noSeededMatches",
              undefined,
              "no unfinished matches have entrants yet",
            )
          : t(
              "piuTourney.noMatches",
              undefined,
              "no unfinished matches found in this tournament",
            )}
      </div>
    );
  }

  const tourneyType = tourney.data?.type ?? null;
  const headToHead = drawable.filter((m) => !isGauntlet(m, tourneyType));
  const gauntlets = drawable.filter((m) => isGauntlet(m, tourneyType));

  function renderMatch(match: PiuMatch) {
    const title = matchTitle(match);
    const players = matchPlayers(match);
    const subtype = isGauntlet(match, tourneyType) ? "gauntlet" : "versus";
    const matchUsed = existingMatches.includes(`piu:${match.id}`);

    return (
      <Card
        key={match.id}
        interactive={!matchUsed}
        style={{ opacity: matchUsed ? 0.5 : undefined }}
        compact
        onClick={
          matchUsed
            ? undefined
            : () =>
                props.onPickMatch?.({
                  provider: "piu",
                  title,
                  players,
                  id: String(match.id),
                  subtype,
                  phaseName: match.round_pools?.name || "",
                  tourneyId: String(tourneyId),
                })
        }
      >
        <Text tagName="p">
          <strong>{title}</strong>
          {" - "}
          {players
            .map((p) => p.name)
            .join(subtype === "versus" ? " vs " : ", ")}
        </Text>
      </Card>
    );
  }

  return (
    <div>
      {header}
      {!!headToHead.length && !!gauntlets.length && (
        <Text tagName="h4">
          {t("piuTourney.headToHead", undefined, "Head to head")}
        </Text>
      )}
      {headToHead.map(renderMatch)}
      {!!headToHead.length && !!gauntlets.length && (
        <Text tagName="h4">
          {t("piuTourney.gauntlet", undefined, "Gauntlet")}
        </Text>
      )}
      {gauntlets.map(renderMatch)}
    </div>
  );
}

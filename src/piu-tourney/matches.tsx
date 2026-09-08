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
 * `formatRoundName` in tourney-maker writes round names as
 * "<label>: <p1> vs. <p2>". Player names render separately from meta.players,
 * so we keep just the label and pair it with the phase, matching how the
 * start.gg picker uses fullRoundText.
 */
function matchTitle(match: PiuMatch) {
  const label = match.name.split(": ")[0];
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
  if (!resp.data.length) {
    return (
      <div>
        {header}{" "}
        {t(
          "piuTourney.noMatches",
          undefined,
          "no unfinished matches found in this tournament",
        )}
      </div>
    );
  }

  const tourneyType = tourney.data?.type ?? null;
  const headToHead = resp.data.filter((m) => !isGauntlet(m, tourneyType));
  const gauntlets = resp.data.filter((m) => isGauntlet(m, tourneyType));

  function renderMatch(match: PiuMatch) {
    const title = matchTitle(match);
    const players = matchPlayers(match);
    const subtype = isGauntlet(match, tourneyType) ? "gauntlet" : "versus";
    const matchUsed = existingMatches.includes(`piu:${match.id}`);
    // byes and not-yet-decided matches are normal here, and drawing for them
    // would produce a set nobody can play
    const pickable = !matchUsed && players.length > 1;

    return (
      <Card
        key={match.id}
        interactive={pickable}
        style={{ opacity: pickable ? undefined : 0.5 }}
        compact
        onClick={
          pickable
            ? () =>
                props.onPickMatch?.({
                  provider: "piu",
                  title,
                  players,
                  id: String(match.id),
                  subtype,
                  phaseName: match.round_pools?.name || "",
                  tourneyId: String(tourneyId),
                })
            : undefined
        }
      >
        <Text tagName="p">
          <strong>{title}</strong>
          {" - "}
          {players.length ? (
            players
              .map((p) => p.name)
              .join(subtype === "versus" ? " vs " : ", ")
          ) : (
            <em>TBD</em>
          )}
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

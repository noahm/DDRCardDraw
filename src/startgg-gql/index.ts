import { Entrant } from "../state/entrants.slice";
import { TournamentSet } from "../state/matches.slice";
import { EventEntrantsDocument, EventSetsDocument } from "./generated/graphql";
import { Client, cacheExchange, fetchExchange } from "@urql/core";

function getClient(token: string) {
  return new Client({
    url: "https://api.start.gg/gql/alpha",
    fetchOptions: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    exchanges: [cacheExchange, fetchExchange],
  });
}

export async function getEventEntrants(token: string, slug: string) {
  const client = getClient(token);
  let pageNo = 0;

  const ret: Entrant[] = [];

  let totalPages = 0;
  do {
    const results = await client.query(EventEntrantsDocument, {
      eventSlug: slug,
      pageNo,
    });
    totalPages = results.data?.event?.entrants?.pageInfo?.totalPages || 0;
    if (results.data?.event?.entrants?.nodes) {
      for (const entrant of results.data.event.entrants.nodes) {
        if (!entrant) continue;
        ret.push({
          id: entrant.id!,
          startggTag: entrant.name!,
        });
      }
    }
    pageNo++;
  } while (totalPages > pageNo + 1);

  return ret;
}

export async function getEventSets(token: string, slug: string) {
  const client = getClient(token);
  let pageNo = 0;

  const ret: TournamentSet[] = [];

  let totalPages = 0;
  do {
    const results = await client.query(EventSetsDocument, {
      eventSlug: slug,
      pageNo,
    });
    totalPages = results.data?.event?.sets?.pageInfo?.totalPages || 0;
    if (results.data?.event?.sets?.nodes) {
      for (const set of results.data.event.sets.nodes) {
        if (!set) continue;
        const players = set.slots!.map((slot) => slot!.entrant?.id);
        ret.push({
          id: set.id!,
          roundText: set.fullRoundText!,
          playerIds: players.filter((pid): pid is string => !!pid),
        });
      }
    }
    pageNo++;
  } while (totalPages > pageNo + 1);

  return ret;
}

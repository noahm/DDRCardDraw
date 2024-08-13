import { useQuery } from "urql";
import { Entrant } from "../state/entrants.slice";
import { TournamentSet } from "../state/matches.slice";
import {
  EventEntrantsDocument,
  EventSetsDocument,
  PlayerNameDocument,
  SetNameDocument,
} from "./generated/graphql";
import { Client, fetchExchange, gql } from "@urql/core";
import { cacheExchange } from "@urql/exchange-graphcache";
import { getDefaultStore, atom, useAtomValue } from "jotai";

export const startggKeyAtom = atom<string | null>(
  process.env.STARTGG_TOKEN as string,
);
export const startggEventSlug = atom<string | null>(
  "tournament/red-october-2024/event/stepmaniax-singles-hard-and-wild",
);

export const urqlClient = new Client({
  url: "https://api.start.gg/gql/alpha",
  fetchOptions: () => ({
    headers: {
      Authorization: `Bearer ${getDefaultStore().get(startggKeyAtom)}`,
    },
  }),
  exchanges: [cacheExchange(), fetchExchange],
});

const PlayerNameDoc: typeof PlayerNameDocument = gql`
  query PlayerName($pid: ID!) {
    entrant(id: $pid) {
      __typename
      id
      name
    }
  }
`;

export function useStartggPlayerName(playerId: string) {
  const [result] = useQuery({
    query: PlayerNameDoc,
    variables: {
      pid: playerId,
    },
  });
  return result.data?.entrant?.name;
}

const SetNameDoc: typeof SetNameDocument = gql`
  query SetName($sid: ID!) {
    set(id: $sid) {
      __typename
      id
      fullRoundText
    }
  }
`;

export function useStartggSetName(setId: string) {
  const [result] = useQuery({
    query: SetNameDoc,
    variables: {
      sid: setId,
    },
  });
  return result.data?.set?.fullRoundText;
}

export function useStartggMatches() {
  const eventSlug = useAtomValue(startggEventSlug)!;
  return useQuery({
    query: EventSetsDoc,
    variables: {
      eventSlug,
      pageNo: 0,
    },
  });
}

const EventEntrantsDoc: typeof EventEntrantsDocument = gql`
  query EventEntrants($eventSlug: String!, $pageNo: Int!) {
    event(slug: $eventSlug) {
      __typename
      id
      name
      entrants(query: { page: $pageNo, perPage: 100 }) {
        pageInfo {
          totalPages
        }
        nodes {
          __typename
          id
          name
          # paginatedSets {
          #   nodes {
          #     id
          #   }
          #   pageInfo {
          #     totalPages
          #   }
          # }
        }
      }
    }
  }
`;

export async function getEventEntrants(slug: string) {
  let pageNo = 0;

  const ret: Entrant[] = [];

  let totalPages = 0;
  do {
    const results = await urqlClient
      .query(EventEntrantsDoc, {
        eventSlug: slug,
        pageNo,
      })
      .toPromise();
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

const EventSetsDoc: typeof EventSetsDocument = gql`
  query EventSets($eventSlug: String!, $pageNo: Int!) {
    event(slug: $eventSlug) {
      id
      sets(filters: { hideEmpty: true }, perPage: 100, page: $pageNo) {
        pageInfo {
          totalPages
          total
        }
        nodes {
          id
          fullRoundText
          identifier
          slots {
            prereqType
            prereqId
            prereqPlacement
            entrant {
              id
              name
            }
          }
        }
      }
    }
  }
`;

export async function getEventSets(slug: string) {
  let pageNo = 0;

  const ret: TournamentSet[] = [];

  let totalPages = 0;
  do {
    const results = await urqlClient
      .query(EventSetsDoc, {
        eventSlug: slug,
        pageNo,
      })
      .toPromise();
    totalPages = results.data?.event?.sets?.pageInfo?.totalPages || 0;
    if (results.data?.event?.sets?.nodes) {
      for (const set of results.data.event.sets.nodes) {
        if (!set) continue;
        ret.push({
          id: set.id!,
          roundText: set.fullRoundText!,
          slots: set.slots!.map((slot) =>
            slot!.entrant?.id
              ? { type: "player", playerId: slot!.entrant.id }
              : { type: "setprereq", setId: slot!.prereqId! },
          ),
        });
      }
    }
    pageNo++;
  } while (totalPages > pageNo + 1);

  return ret;
}

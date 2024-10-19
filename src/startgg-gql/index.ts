import { useMutation, useQuery } from "urql";
import type {
  EventSetsDocument,
  PlayerNameDocument,
  ReportSetDocument,
  SetNameDocument,
  EventListDocument,
  GauntletDivisionsDocument,
} from "./generated/graphql";
import { Client, fetchExchange, gql } from "@urql/core";
import { cacheExchange } from "@urql/exchange-graphcache";
import { getDefaultStore, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const startggKeyAtom = atomWithStorage<string | null>(
  "ddrtools.event.startggtoken",
  process.env.STARTGG_TOKEN as string,
  undefined,
  { getOnInit: true },
);
export const startggEventSlug = atomWithStorage<string | null>(
  "ddrtools.event.startggslug",
  "tournament/red-october-2024/event/stepmaniax-full-mode",
  undefined,
  { getOnInit: true },
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

export function useStartggPhases() {
  const eventSlug = useAtomValue(startggEventSlug)!;
  return useQuery({
    query: GauntletDivisions,
    variables: {
      eventSlug,
    },
  });
}

const GauntletDivisions: typeof GauntletDivisionsDocument = gql`
  query GauntletDivisions($eventSlug: String!) {
    event(slug: $eventSlug) {
      id
      phases {
        id
        name
        state
        bracketType
        seeds(query: { page: 0, perPage: 32 }) {
          nodes {
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
            id
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

const ReportSetMutation: typeof ReportSetDocument = gql`
  mutation ReportSet(
    $setId: ID!
    $winnerId: ID
    $gameData: [BracketSetGameDataInput]
  ) {
    reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {
      id
      completedAt
    }
  }
`;

export type {
  BracketSetGameDataInput,
  ReportSetMutationVariables,
} from "./generated/graphql";

/**
 * Passing a winnerId will mark the set as completed.
 * Passing game data will overwrite any existing game data.
 */
export function useReportSetMutation() {
  return useMutation(ReportSetMutation);
}

const EventListQuery: typeof EventListDocument = gql`
  query EventList($page: Int!, $perPage: Int!) {
    currentUser {
      tournaments(
        query: {
          page: $page
          perPage: $perPage
          filter: { tournamentView: "admin" }
        }
      ) {
        nodes {
          id
          name
          slug
          events {
            id
            name
            slug
          }
        }
        pageInfo {
          total
          totalPages
          page
          perPage
        }
      }
    }
  }
`;

export function useCurrentUserEvents() {
  return useQuery({
    query: EventListQuery,
    variables: {
      page: 1,
      perPage: 25,
    },
  });
}

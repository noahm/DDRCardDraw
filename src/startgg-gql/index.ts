import { useMutation, useQuery } from "urql";
import {
  EventSetsDocument,
  PlayerNameDocument,
  ReportSetDocument,
  SetNameDocument,
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
  "tournament/red-october-2024/event/stepmaniax-singles-hard-and-wild",
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

// const EventEntrantsDoc: typeof EventEntrantsDocument = gql`
//   query EventEntrants($eventSlug: String!, $pageNo: Int!) {
//     event(slug: $eventSlug) {
//       __typename
//       id
//       name
//       entrants(query: { page: $pageNo, perPage: 100 }) {
//         pageInfo {
//           totalPages
//         }
//         nodes {
//           __typename
//           id
//           name
//           # paginatedSets {
//           #   nodes {
//           #     id
//           #   }
//           #   pageInfo {
//           #     totalPages
//           #   }
//           # }
//         }
//       }
//     }
//   }
// `;

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

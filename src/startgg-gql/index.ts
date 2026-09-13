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

/**
 * Accepts a start.gg event URL or a bare `tournament/x/event/y` slug and
 * returns just the two-segment pair the API takes as an event slug.
 *
 * Everything past the event is dropped, since the address bar is where these
 * get copied from and it's rarely sitting on the bare event page —
 * `…/event/singles/brackets/1234/5678` and `…/event/singles/overview` both
 * come back as `tournament/foo/event/singles`. Returns null when there's no
 * event slug in there to find, so the caller can say so rather than saving a
 * slug every query will 404 on.
 */
export function parseEventSlug(raw: string): string | null {
  const match = raw
    .trim()
    // an origin, if pasted as a full URL. The scheme is optional because
    // copying a link out of running text tends to lose it.
    .replace(/^(?:https?:)?\/\//i, "")
    .replace(/^(?:www\.)?(?:start|smash)\.gg/i, "")
    // neither a query string nor a fragment is ever part of the slug
    .replace(/[?#].*$/, "")
    .match(/^\/?tournament\/([\w-]+)\/event\/([\w-]+)(?:\/|$)/i);
  if (!match) return null;
  return `tournament/${match[1]}/event/${match[2]}`;
}

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
              participants {
                id
                user {
                  id
                  genderPronoun
                }
              }
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
              participants {
                id
                user {
                  id
                  genderPronoun
                }
              }
            }
          }
          phaseGroup {
            displayIdentifier
            phase {
              name
              groupCount
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
          # only the first page is ever fetched, so the sort decides which
          # tournaments are reachable at all. Default order buries a TO with
          # a long history under events from years ago, hiding the one they
          # are running this weekend.
          sortBy: "startAt desc"
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

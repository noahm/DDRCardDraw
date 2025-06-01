/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
const documents = {
    "\n  query PlayerName($pid: ID!) {\n    entrant(id: $pid) {\n      __typename\n      id\n      name\n    }\n  }\n": types.PlayerNameDocument,
    "\n  query SetName($sid: ID!) {\n    set(id: $sid) {\n      __typename\n      id\n      fullRoundText\n    }\n  }\n": types.SetNameDocument,
    "\n  query GauntletDivisions($eventSlug: String!) {\n    event(slug: $eventSlug) {\n      id\n      phases {\n        id\n        name\n        state\n        bracketType\n        seeds(query: { page: 0, perPage: 32 }) {\n          nodes {\n            entrant {\n              id\n              name\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GauntletDivisionsDocument,
    "\n  query EventSets($eventSlug: String!, $pageNo: Int!) {\n    event(slug: $eventSlug) {\n      id\n      sets(filters: { hideEmpty: true }, perPage: 100, page: $pageNo) {\n        pageInfo {\n          totalPages\n          total\n        }\n        nodes {\n          id\n          fullRoundText\n          identifier\n          slots {\n            id\n            prereqType\n            prereqId\n            prereqPlacement\n            entrant {\n              id\n              name\n            }\n          }\n        }\n      }\n    }\n  }\n": types.EventSetsDocument,
    "\n  mutation ReportSet(\n    $setId: ID!\n    $winnerId: ID\n    $gameData: [BracketSetGameDataInput]\n  ) {\n    reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {\n      id\n      completedAt\n    }\n  }\n": types.ReportSetDocument,
    "\n  query EventList($page: Int!, $perPage: Int!) {\n    currentUser {\n      tournaments(\n        query: {\n          page: $page\n          perPage: $perPage\n          filter: { tournamentView: \"admin\" }\n        }\n      ) {\n        nodes {\n          id\n          name\n          slug\n          events {\n            id\n            name\n            slug\n          }\n        }\n        pageInfo {\n          total\n          totalPages\n          page\n          perPage\n        }\n      }\n    }\n  }\n": types.EventListDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PlayerName($pid: ID!) {\n    entrant(id: $pid) {\n      __typename\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query PlayerName($pid: ID!) {\n    entrant(id: $pid) {\n      __typename\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SetName($sid: ID!) {\n    set(id: $sid) {\n      __typename\n      id\n      fullRoundText\n    }\n  }\n"): (typeof documents)["\n  query SetName($sid: ID!) {\n    set(id: $sid) {\n      __typename\n      id\n      fullRoundText\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GauntletDivisions($eventSlug: String!) {\n    event(slug: $eventSlug) {\n      id\n      phases {\n        id\n        name\n        state\n        bracketType\n        seeds(query: { page: 0, perPage: 32 }) {\n          nodes {\n            entrant {\n              id\n              name\n            }\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GauntletDivisions($eventSlug: String!) {\n    event(slug: $eventSlug) {\n      id\n      phases {\n        id\n        name\n        state\n        bracketType\n        seeds(query: { page: 0, perPage: 32 }) {\n          nodes {\n            entrant {\n              id\n              name\n            }\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query EventSets($eventSlug: String!, $pageNo: Int!) {\n    event(slug: $eventSlug) {\n      id\n      sets(filters: { hideEmpty: true }, perPage: 100, page: $pageNo) {\n        pageInfo {\n          totalPages\n          total\n        }\n        nodes {\n          id\n          fullRoundText\n          identifier\n          slots {\n            id\n            prereqType\n            prereqId\n            prereqPlacement\n            entrant {\n              id\n              name\n            }\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query EventSets($eventSlug: String!, $pageNo: Int!) {\n    event(slug: $eventSlug) {\n      id\n      sets(filters: { hideEmpty: true }, perPage: 100, page: $pageNo) {\n        pageInfo {\n          totalPages\n          total\n        }\n        nodes {\n          id\n          fullRoundText\n          identifier\n          slots {\n            id\n            prereqType\n            prereqId\n            prereqPlacement\n            entrant {\n              id\n              name\n            }\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ReportSet(\n    $setId: ID!\n    $winnerId: ID\n    $gameData: [BracketSetGameDataInput]\n  ) {\n    reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {\n      id\n      completedAt\n    }\n  }\n"): (typeof documents)["\n  mutation ReportSet(\n    $setId: ID!\n    $winnerId: ID\n    $gameData: [BracketSetGameDataInput]\n  ) {\n    reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {\n      id\n      completedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query EventList($page: Int!, $perPage: Int!) {\n    currentUser {\n      tournaments(\n        query: {\n          page: $page\n          perPage: $perPage\n          filter: { tournamentView: \"admin\" }\n        }\n      ) {\n        nodes {\n          id\n          name\n          slug\n          events {\n            id\n            name\n            slug\n          }\n        }\n        pageInfo {\n          total\n          totalPages\n          page\n          perPage\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query EventList($page: Int!, $perPage: Int!) {\n    currentUser {\n      tournaments(\n        query: {\n          page: $page\n          perPage: $perPage\n          filter: { tournamentView: \"admin\" }\n        }\n      ) {\n        nodes {\n          id\n          name\n          slug\n          events {\n            id\n            name\n            slug\n          }\n        }\n        pageInfo {\n          total\n          totalPages\n          page\n          perPage\n        }\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;
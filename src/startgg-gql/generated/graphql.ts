/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /**
   * The `JSON` scalar type represents JSON values as specified by
   * 		[ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).
   */
  JSON: { input: any; output: any; }
  /**
   * Represents a Unix Timestamp. Supports up to 53 bit int values,
   * 		as that is JavaScript's internal memory allocation for integer values.
   */
  Timestamp: { input: any; output: any; }
};

/** Represents the state of an activity */
export enum ActivityState {
  /** Activity is active or in progress */
  Active = 'ACTIVE',
  /** Activity, like a set, has been called to start */
  Called = 'CALLED',
  /** Activity is done */
  Completed = 'COMPLETED',
  /** Activity is created */
  Created = 'CREATED',
  /** Activity is invalid */
  Invalid = 'INVALID',
  /** Activity is queued to run */
  Queued = 'QUEUED',
  /** Activity is ready to be started */
  Ready = 'READY'
}

/** Represents the name of the third-party service (e.g Twitter) for OAuth */
export enum AuthorizationType {
  Battlenet = 'BATTLENET',
  Discord = 'DISCORD',
  Epic = 'EPIC',
  Mixer = 'MIXER',
  Steam = 'STEAM',
  Twitch = 'TWITCH',
  Twitter = 'TWITTER',
  Xbox = 'XBOX'
}

/** Game specific H2H set data such as character, stage, and stock info */
export type BracketSetGameDataInput = {
  /** Score for entrant 1 (if applicable). For smash, this is stocks remaining. */
  entrant1Score?: InputMaybe<Scalars['Int']['input']>;
  /** Score for entrant 2 (if applicable). For smash, this is stocks remaining. */
  entrant2Score?: InputMaybe<Scalars['Int']['input']>;
  /** Game number */
  gameNum: Scalars['Int']['input'];
  /** List of selections for the game, typically character selections. */
  selections?: InputMaybe<Array<InputMaybe<BracketSetGameSelectionInput>>>;
  /** ID of the stage that was played for this game (if applicable) */
  stageId?: InputMaybe<Scalars['ID']['input']>;
  /** Entrant ID of game winner */
  winnerId?: InputMaybe<Scalars['ID']['input']>;
};

/** Game specific H2H selections made by the entrants, such as character info */
export type BracketSetGameSelectionInput = {
  /** Character selected by this entrant for this game. */
  characterId?: InputMaybe<Scalars['Int']['input']>;
  /** Entrant ID that made selection */
  entrantId: Scalars['ID']['input'];
};

/** The type of Bracket format that a Phase is configured with. */
export enum BracketType {
  Circuit = 'CIRCUIT',
  CustomSchedule = 'CUSTOM_SCHEDULE',
  DoubleElimination = 'DOUBLE_ELIMINATION',
  EliminationRounds = 'ELIMINATION_ROUNDS',
  Exhibition = 'EXHIBITION',
  Matchmaking = 'MATCHMAKING',
  Race = 'RACE',
  RoundRobin = 'ROUND_ROBIN',
  SingleElimination = 'SINGLE_ELIMINATION',
  Swiss = 'SWISS'
}

/** Comparison operator */
export enum Comparator {
  Equal = 'EQUAL',
  GreaterThan = 'GREATER_THAN',
  GreaterThanOrEqual = 'GREATER_THAN_OR_EQUAL',
  LessThan = 'LESS_THAN',
  LessThanOrEqual = 'LESS_THAN_OR_EQUAL'
}

export type EventEntrantPageQuery = {
  filter?: InputMaybe<EventEntrantPageQueryFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type EventEntrantPageQueryFilter = {
  name?: InputMaybe<Scalars['String']['input']>;
};

export type EventFilter = {
  fantasyEventId?: InputMaybe<Scalars['ID']['input']>;
  fantasyRosterHash?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  videogameId?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type EventOwnersQuery = {
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

/** The type of selection i.e. is it for a character or something else */
export enum GameSelectionType {
  /** Character selection */
  Character = 'CHARACTER'
}

export type LeagueEventsFilter = {
  leagueEntrantId?: InputMaybe<Scalars['ID']['input']>;
  pointMappingGroupIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  search?: InputMaybe<PaginationSearchType>;
  tierIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  upcoming?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type LeagueEventsQuery = {
  filter?: InputMaybe<LeagueEventsFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type LeaguePageFilter = {
  activeShops?: InputMaybe<Scalars['Boolean']['input']>;
  afterDate?: InputMaybe<Scalars['Timestamp']['input']>;
  beforeDate?: InputMaybe<Scalars['Timestamp']['input']>;
  computedUpdatedAt?: InputMaybe<Scalars['Timestamp']['input']>;
  hasBannerImages?: InputMaybe<Scalars['Boolean']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  isFeatured?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  /** ID of the user that owns this league. */
  ownerId?: InputMaybe<Scalars['ID']['input']>;
  past?: InputMaybe<Scalars['Boolean']['input']>;
  publiclySearchable?: InputMaybe<Scalars['Boolean']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  upcoming?: InputMaybe<Scalars['Boolean']['input']>;
  videogameIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type LeagueQuery = {
  filter?: InputMaybe<LeaguePageFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<TournamentPaginationSort>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type LocationFilterType = {
  city?: InputMaybe<Scalars['String']['input']>;
  countryCode?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
};

/** Different options available for verifying player-reported match results */
export enum MatchConfigVerificationMethod {
  Any = 'ANY',
  Mixer = 'MIXER',
  StreamMe = 'STREAM_ME',
  Twitch = 'TWITCH',
  Youtube = 'YOUTUBE'
}

export type PaginationSearchType = {
  fieldsToSearch?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  searchString?: InputMaybe<Scalars['String']['input']>;
};

export type ParticipantPageFilter = {
  checkedIn?: InputMaybe<Scalars['Boolean']['input']>;
  eventIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  gamerTag?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  incompleteTeam?: InputMaybe<Scalars['Boolean']['input']>;
  missingDeck?: InputMaybe<Scalars['Boolean']['input']>;
  notCheckedIn?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<PaginationSearchType>;
  unpaid?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ParticipantPaginationQuery = {
  filter?: InputMaybe<ParticipantPageFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type PhaseGroupPageQuery = {
  entrantIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  filter?: InputMaybe<PhaseGroupPageQueryFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type PhaseGroupPageQueryFilter = {
  id?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  waveId?: InputMaybe<Scalars['ID']['input']>;
};

export type PhaseGroupUpdateInput = {
  phaseGroupId: Scalars['ID']['input'];
  stationId?: InputMaybe<Scalars['ID']['input']>;
  waveId?: InputMaybe<Scalars['ID']['input']>;
};

export type PhaseUpsertInput = {
  bracketType?: InputMaybe<BracketType>;
  /** The number of pools to configure for the Phase. Only applies to brackets that support pools */
  groupCount?: InputMaybe<Scalars['Int']['input']>;
  /** The name of the Phase. For example, "Top 8" or "Pools" */
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Enforces limits on the amount of allowable Race submissions */
export enum RaceLimitMode {
  BestAll = 'BEST_ALL',
  FirstAll = 'FIRST_ALL',
  Playtime = 'PLAYTIME'
}

/** Race type */
export enum RaceType {
  Goals = 'GOALS',
  Timed = 'TIMED'
}

export type ResolveConflictsLockedSeedConfig = {
  eventId: Scalars['ID']['input'];
  numSeeds: Scalars['Int']['input'];
};

export type ResolveConflictsOptions = {
  lockedSeeds?: InputMaybe<Array<InputMaybe<ResolveConflictsLockedSeedConfig>>>;
};

export type SeedPageFilter = {
  checkInState?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  entrantName?: InputMaybe<Scalars['String']['input']>;
  eventCheckInGroupId?: InputMaybe<Scalars['ID']['input']>;
  eventId?: InputMaybe<Scalars['ID']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  phaseGroupId?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  phaseId?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  search?: InputMaybe<PaginationSearchType>;
};

export type SeedPaginationQuery = {
  filter?: InputMaybe<SeedPageFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

/** Filter Sets by geographical constraints. */
export type SetFilterLocation = {
  /** Only return Sets in this country. Expects a valid two-letter country code */
  country?: InputMaybe<Scalars['String']['input']>;
  distanceFrom?: InputMaybe<SetFilterLocationDistanceFrom>;
  /** Only return Sets in this state. Only applicable to US states */
  state?: InputMaybe<Scalars['String']['input']>;
};

/** Only return Sets that are a certain distance away from a specified point */
export type SetFilterLocationDistanceFrom = {
  /** Point at which to perform distance calculation */
  point?: InputMaybe<SetFilterLocationDistanceFromPoint>;
  /** Distance from the point to include results in */
  radius?: InputMaybe<Scalars['String']['input']>;
};

export type SetFilterLocationDistanceFromPoint = {
  lat?: InputMaybe<Scalars['Float']['input']>;
  lon?: InputMaybe<Scalars['Float']['input']>;
};

export type SetFilters = {
  /** Only return Sets for these Entrants */
  entrantIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** Only return Sets for this Entrant size. For example, to fetch 1v1 Sets only, filter by an entrantSize of 1 */
  entrantSize?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  /** Only return Sets in these Events */
  eventIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** Only return Sets that have an attached VOD */
  hasVod?: InputMaybe<Scalars['Boolean']['input']>;
  /** Do not return empty Sets. For example, set this to true to filter out sets that are waiting for progressions. */
  hideEmpty?: InputMaybe<Scalars['Boolean']['input']>;
  /** Only return Sets that are in an Online event. If omitted, Sets for both online and offline Events are returned */
  isEventOnline?: InputMaybe<Scalars['Boolean']['input']>;
  /** Only return Sets in certain geographical areas. */
  location?: InputMaybe<SetFilterLocation>;
  /** Only return Sets for these Participants */
  participantIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** Only return Sets in these PhaseGroups */
  phaseGroupIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** Only return Sets in these Phases */
  phaseIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** Only return Sets for these Players */
  playerIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** Only return Sets for these Rounds */
  roundNumber?: InputMaybe<Scalars['Int']['input']>;
  /** Return sets that contain a bye */
  showByes?: InputMaybe<Scalars['Boolean']['input']>;
  /** Only returns Sets that are in these states */
  state?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  /** Only return Sets that are assigned to these Station IDs */
  stationIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** Only return Sets that are assigned to these Station numbers */
  stationNumbers?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  /** Only return Sets in these Tournaments */
  tournamentIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** Only return sets created or updated since this timestamp */
  updatedAfter?: InputMaybe<Scalars['Timestamp']['input']>;
};

/** Different sort type configurations used when displaying multiple sets */
export enum SetSortType {
  /** Sets are sorted in the suggested order that they be called to be played. The order of completed sets is reversed. */
  CallOrder = 'CALL_ORDER',
  /** Sets are sorted by relevancy dependent on the state and progress of the event. */
  Magic = 'MAGIC',
  /** Sets will not be sorted. */
  None = 'NONE',
  /** Sets are sorted in the order that they were started. */
  Recent = 'RECENT',
  /** Sets sorted by round and identifier */
  Round = 'ROUND',
  /** Deprecated. This is equivalent to CALL_ORDER */
  Standard = 'STANDARD'
}

export type ShopLevelsQuery = {
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type ShopOrderMessagesQuery = {
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

/** Represents the name of the third-party social service (e.g Twitter) for OAuth */
export enum SocialConnectionType {
  Discord = 'DISCORD',
  Mixer = 'MIXER',
  Twitch = 'TWITCH',
  Twitter = 'TWITTER',
  Xbox = 'XBOX'
}

export type StandingGroupStandingPageFilter = {
  page?: InputMaybe<Scalars['Int']['input']>;
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type StandingPageFilter = {
  id?: InputMaybe<Scalars['ID']['input']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  search?: InputMaybe<PaginationSearchType>;
};

export type StandingPaginationQuery = {
  filter?: InputMaybe<StandingPageFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type StationFilter = {
  page?: InputMaybe<Scalars['Int']['input']>;
  perPage?: InputMaybe<Scalars['Int']['input']>;
};

export type StationUpsertInput = {
  clusterId?: InputMaybe<Scalars['ID']['input']>;
  number: Scalars['Int']['input'];
};

/** Represents the source of a stream */
export enum StreamSource {
  /** Stream is on smashcast.tv channel */
  Hitbox = 'HITBOX',
  /** Stream is on a mixer.com channel */
  Mixer = 'MIXER',
  /** Stream is on a stream.me channel */
  Streamme = 'STREAMME',
  /** Stream is on twitch.tv channel */
  Twitch = 'TWITCH',
  /** Stream is on a youtube.com channel */
  Youtube = 'YOUTUBE'
}

/** Represents the type of stream service */
export enum StreamType {
  Mixer = 'MIXER',
  Twitch = 'TWITCH',
  Youtube = 'YOUTUBE'
}

/** Membership status of a team member */
export enum TeamMemberStatus {
  Accepted = 'ACCEPTED',
  Alum = 'ALUM',
  Hiatus = 'HIATUS',
  Invited = 'INVITED',
  OpenSpot = 'OPEN_SPOT',
  Request = 'REQUEST',
  Unknown = 'UNKNOWN'
}

/** Membership type of a team member */
export enum TeamMemberType {
  Player = 'PLAYER',
  Staff = 'STAFF'
}

export type TeamPaginationFilter = {
  eventId?: InputMaybe<Scalars['ID']['input']>;
  eventIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  eventState?: InputMaybe<ActivityState>;
  globalTeamId?: InputMaybe<Scalars['ID']['input']>;
  isLeague?: InputMaybe<Scalars['Boolean']['input']>;
  maxEntrantCount?: InputMaybe<Scalars['Int']['input']>;
  memberStatus?: InputMaybe<Array<InputMaybe<TeamMemberStatus>>>;
  minEntrantCount?: InputMaybe<Scalars['Int']['input']>;
  past?: InputMaybe<Scalars['Boolean']['input']>;
  rosterComplete?: InputMaybe<Scalars['Boolean']['input']>;
  rosterIncomplete?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<PaginationSearchType>;
  tournamentId?: InputMaybe<Scalars['ID']['input']>;
  type?: InputMaybe<Scalars['Int']['input']>;
  upcoming?: InputMaybe<Scalars['Boolean']['input']>;
  videogameId?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type TeamPaginationQuery = {
  filter?: InputMaybe<TeamPaginationFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type TopGameFilter = {
  /** Array of which # top game you want to filter on.e.g. [2, 3] will filter on the 2nd and 3rd top games */
  gameNums?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export type TournamentLocationFilter = {
  /** e.g. 50mi */
  distance?: InputMaybe<Scalars['String']['input']>;
  /** Latitude, Longitude */
  distanceFrom?: InputMaybe<Scalars['String']['input']>;
};

export type TournamentPageFilter = {
  activeShops?: InputMaybe<Scalars['Boolean']['input']>;
  addrState?: InputMaybe<Scalars['String']['input']>;
  afterDate?: InputMaybe<Scalars['Timestamp']['input']>;
  beforeDate?: InputMaybe<Scalars['Timestamp']['input']>;
  computedUpdatedAt?: InputMaybe<Scalars['Timestamp']['input']>;
  countryCode?: InputMaybe<Scalars['String']['input']>;
  hasBannerImages?: InputMaybe<Scalars['Boolean']['input']>;
  hasOnlineEvents?: InputMaybe<Scalars['Boolean']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** If true, filter to only tournaments the currently authed user is an admin of */
  isCurrentUserAdmin?: InputMaybe<Scalars['Boolean']['input']>;
  isFeatured?: InputMaybe<Scalars['Boolean']['input']>;
  isLeague?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<TournamentLocationFilter>;
  name?: InputMaybe<Scalars['String']['input']>;
  /** ID of the user that owns this tournament. */
  ownerId?: InputMaybe<Scalars['ID']['input']>;
  past?: InputMaybe<Scalars['Boolean']['input']>;
  publiclySearchable?: InputMaybe<Scalars['Boolean']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  regOpen?: InputMaybe<Scalars['Boolean']['input']>;
  sortByScore?: InputMaybe<Scalars['Boolean']['input']>;
  staffPicks?: InputMaybe<Scalars['Boolean']['input']>;
  topGames?: InputMaybe<TopGameFilter>;
  upcoming?: InputMaybe<Scalars['Boolean']['input']>;
  venueName?: InputMaybe<Scalars['String']['input']>;
  videogameIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export enum TournamentPaginationSort {
  ComputedUpdatedAt = 'computedUpdatedAt',
  EndAt = 'endAt',
  EventRegistrationClosesAt = 'eventRegistrationClosesAt',
  StartAt = 'startAt'
}

export type TournamentQuery = {
  filter?: InputMaybe<TournamentPageFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<TournamentPaginationSort>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type TournamentRegistrationInput = {
  eventIds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type UpdatePhaseSeedInfo = {
  phaseGroupId?: InputMaybe<Scalars['ID']['input']>;
  seedId: Scalars['ID']['input'];
  seedNum: Scalars['ID']['input'];
};

export type UpdatePhaseSeedingOptions = {
  /** Validate that seedMapping exactly accounts for all entrants in the phase */
  strictMode?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UserEventsPaginationFilter = {
  eventType?: InputMaybe<Scalars['Int']['input']>;
  location?: InputMaybe<LocationFilterType>;
  maxEntrantCount?: InputMaybe<Scalars['Int']['input']>;
  minEntrantCount?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<PaginationSearchType>;
  videogameId?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type UserEventsPaginationQuery = {
  filter?: InputMaybe<UserEventsPaginationFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type UserLeaguesPaginationFilter = {
  past?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<PaginationSearchType>;
  upcoming?: InputMaybe<Scalars['Boolean']['input']>;
  videogameId?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type UserLeaguesPaginationQuery = {
  filter?: InputMaybe<UserLeaguesPaginationFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type UserTournamentsPaginationFilter = {
  excludeId?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  past?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<PaginationSearchType>;
  tournamentView?: InputMaybe<Scalars['String']['input']>;
  upcoming?: InputMaybe<Scalars['Boolean']['input']>;
  videogameId?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type UserTournamentsPaginationQuery = {
  filter?: InputMaybe<UserTournamentsPaginationFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type VideogamePageFilter = {
  forUser?: InputMaybe<Scalars['ID']['input']>;
  id?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type VideogameQuery = {
  filter?: InputMaybe<VideogamePageFilter>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** How many nodes to return for the page. Maximum value of 500 */
  perPage?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
};

export type WaveUpsertInput = {
  endAt: Scalars['Timestamp']['input'];
  identifier: Scalars['String']['input'];
  startAt: Scalars['Timestamp']['input'];
};

export type PlayerNameQueryVariables = Exact<{
  pid: Scalars['ID']['input'];
}>;


export type PlayerNameQuery = { __typename?: 'Query', entrant?: { __typename: 'Entrant', id?: string | null, name?: string | null } | null };

export type SetNameQueryVariables = Exact<{
  sid: Scalars['ID']['input'];
}>;


export type SetNameQuery = { __typename?: 'Query', set?: { __typename: 'Set', id?: string | null, fullRoundText?: string | null } | null };

export type GauntletDivisionsQueryVariables = Exact<{
  eventSlug: Scalars['String']['input'];
}>;


export type GauntletDivisionsQuery = { __typename?: 'Query', event?: { __typename?: 'Event', id?: string | null, phases?: Array<{ __typename?: 'Phase', id?: string | null, name?: string | null, state?: ActivityState | null, bracketType?: BracketType | null, seeds?: { __typename?: 'SeedConnection', nodes?: Array<{ __typename?: 'Seed', entrant?: { __typename?: 'Entrant', id?: string | null, name?: string | null } | null } | null> | null } | null } | null> | null } | null };

export type EventSetsQueryVariables = Exact<{
  eventSlug: Scalars['String']['input'];
  pageNo: Scalars['Int']['input'];
}>;


export type EventSetsQuery = { __typename?: 'Query', event?: { __typename?: 'Event', id?: string | null, sets?: { __typename?: 'SetConnection', pageInfo?: { __typename?: 'PageInfo', totalPages?: number | null, total?: number | null } | null, nodes?: Array<{ __typename?: 'Set', id?: string | null, fullRoundText?: string | null, identifier?: string | null, slots?: Array<{ __typename?: 'SetSlot', id?: string | null, prereqType?: string | null, prereqId?: string | null, prereqPlacement?: number | null, entrant?: { __typename?: 'Entrant', id?: string | null, name?: string | null } | null } | null> | null } | null> | null } | null } | null };

export type ReportSetMutationVariables = Exact<{
  setId: Scalars['ID']['input'];
  winnerId?: InputMaybe<Scalars['ID']['input']>;
  gameData?: InputMaybe<Array<InputMaybe<BracketSetGameDataInput>> | InputMaybe<BracketSetGameDataInput>>;
}>;


export type ReportSetMutation = { __typename?: 'Mutation', reportBracketSet?: Array<{ __typename?: 'Set', id?: string | null, completedAt?: any | null } | null> | null };

export type EventListQueryVariables = Exact<{
  page: Scalars['Int']['input'];
  perPage: Scalars['Int']['input'];
}>;


export type EventListQuery = { __typename?: 'Query', currentUser?: { __typename?: 'User', tournaments?: { __typename?: 'TournamentConnection', nodes?: Array<{ __typename?: 'Tournament', id?: string | null, name?: string | null, slug?: string | null, events?: Array<{ __typename?: 'Event', id?: string | null, name?: string | null, slug?: string | null } | null> | null } | null> | null, pageInfo?: { __typename?: 'PageInfo', total?: number | null, totalPages?: number | null, page?: number | null, perPage?: number | null } | null } | null } | null };


export const PlayerNameDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PlayerName"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pid"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"entrant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pid"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<PlayerNameQuery, PlayerNameQueryVariables>;
export const SetNameDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SetName"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sid"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"set"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sid"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullRoundText"}}]}}]}}]} as unknown as DocumentNode<SetNameQuery, SetNameQueryVariables>;
export const GauntletDivisionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GauntletDivisions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"eventSlug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"event"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"eventSlug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"phases"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"bracketType"}},{"kind":"Field","name":{"kind":"Name","value":"seeds"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"page"},"value":{"kind":"IntValue","value":"0"}},{"kind":"ObjectField","name":{"kind":"Name","value":"perPage"},"value":{"kind":"IntValue","value":"32"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"entrant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GauntletDivisionsQuery, GauntletDivisionsQueryVariables>;
export const EventSetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EventSets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"eventSlug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageNo"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"event"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"eventSlug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"hideEmpty"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"Argument","name":{"kind":"Name","value":"perPage"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageNo"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalPages"}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullRoundText"}},{"kind":"Field","name":{"kind":"Name","value":"identifier"}},{"kind":"Field","name":{"kind":"Name","value":"slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"prereqType"}},{"kind":"Field","name":{"kind":"Name","value":"prereqId"}},{"kind":"Field","name":{"kind":"Name","value":"prereqPlacement"}},{"kind":"Field","name":{"kind":"Name","value":"entrant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<EventSetsQuery, EventSetsQueryVariables>;
export const ReportSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReportSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"setId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"winnerId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"gameData"}},"type":{"kind":"ListType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BracketSetGameDataInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reportBracketSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"setId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"setId"}}},{"kind":"Argument","name":{"kind":"Name","value":"winnerId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"winnerId"}}},{"kind":"Argument","name":{"kind":"Name","value":"gameData"},"value":{"kind":"Variable","name":{"kind":"Name","value":"gameData"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]}}]} as unknown as DocumentNode<ReportSetMutation, ReportSetMutationVariables>;
export const EventListDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EventList"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"perPage"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"perPage"},"value":{"kind":"Variable","name":{"kind":"Name","value":"perPage"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"tournamentView"},"value":{"kind":"StringValue","value":"admin","block":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"events"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}},{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"perPage"}}]}}]}}]}}]}}]} as unknown as DocumentNode<EventListQuery, EventListQueryVariables>;
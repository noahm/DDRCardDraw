import type { EligibleChart, Player } from "../models/Drawing";
import type { GameData } from "../models/SongData";
import { readExtra } from "./extras";
import { EDIT_ID_KEY, fetchEditCharts } from "./smx-edit-import";

/**
 * Reads the StepManiaX global score feed (the community API at api.smx.573.no,
 * documented at https://github.com/DesktopMan/smx-api-docs) so a tournament can
 * pull the plays its entrants just put up on a cab instead of typing scores in
 * by hand.
 *
 * The feed is global and anonymous to us: every SMX cab in the world posts to
 * it, and a score names a *gamer* rather than a bracket entrant. So recording
 * stays semi-automatic — this module narrows the feed to plays on one drawing's
 * charts within a recent window, and a human confirms which entrant each play
 * belongs to before anything is recorded.
 *
 * ## Matching plays to drawn charts
 *
 * A score names a `song_chart_id`, which our game data doesn't carry: a song
 * knows its `saIndex` (the API's `song_id`, see smx-edit-import) and a chart
 * knows its difficulty class. So the API's charts for the drawn songs are
 * fetched once and matched up by difficulty; the scores query then filters on
 * the resulting chart ids, which is exact.
 */

const API_BASE = "https://api.smx.573.no";

/** the API's hard cap on results per request */
const MAX_TAKE = 100;

const REQUEST_TIMEOUT = 15_000;

/**
 * How many pages of scores to walk. A page holds 100 plays on this drawing's
 * charts inside the requested window, which is already far more than a match
 * produces; the extra pages only matter when a drawn chart happens to be
 * popular worldwide at that moment.
 */
const MAX_SCORE_PAGES = 3;

/** the chart objects returned by the charts endpoint, and embedded in scores */
export interface SmxApiChart {
  id: number;
  song_id: number;
  /**
   * the difficulty class: `basic`, `easy`, `hard`, `wild`, `dual`, `full` or
   * `edit`, with a trailing `2` marking the harder "plus" cut (`hard2`).
   * Prefer this over `difficulty_display`, which some songs have scrambled.
   */
  difficulty_name?: string;
  /** the chart's numeric rating */
  meter?: number;
  difficulty?: number;
  /** share code, on published edit charts only */
  edit_display_id?: string | null;
}

/** the score objects returned by the scores endpoint */
export interface SmxApiScore {
  id: number;
  song_chart_id: number;
  score: number;
  full_combo?: boolean;
  gamer_id?: number;
  gamer?: { id?: number; username?: string | null } | null;
  created_at?: string;
  updated_at?: string;
}

async function apiQuery<T>(
  endpoint: string,
  q: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T[]> {
  const url = `${API_BASE}/${endpoint}?q=${encodeURIComponent(JSON.stringify(q))}`;
  const res = await fetch(url, {
    signal: AbortSignal.any(
      signal
        ? [signal, AbortSignal.timeout(REQUEST_TIMEOUT)]
        : [AbortSignal.timeout(REQUEST_TIMEOUT)],
    ),
  });
  if (!res.ok) {
    throw new Error(
      `SMX API ${endpoint} request failed with status ${res.status}`,
    );
  }
  return (await res.json()) as T[];
}

/**
 * Whether a config is drawing from StepManiaX, and so has plays to import: the
 * stock catalog, or a custom data set built on top of it (the edit importer
 * stamps those with the smx card variant).
 */
export function isSmxGameData(gameKey: string, gameData: GameData | null) {
  return gameKey === "smx" || gameData?.meta.cardVariant === "smx";
}

/** identifies one SMX chart in terms of what our game data carries */
export interface SmxChartKey {
  /** the API's `song_id`, which our data stores as `saIndex` */
  songId: string;
  /** the game data's difficulty key, e.g. `wild` */
  diffClass: string | undefined;
  lvl: number;
  /** true for the harder "plus" cut of a difficulty */
  plus: boolean;
  /** share code of an edit chart, when the drawn chart is one */
  editId?: string;
}

/** a drawn chart, paired with what it takes to find its plays in the feed */
export interface SmxChartTarget {
  /** id of the drawn chart — where a score gets recorded */
  chartId: string;
  /** the chart actually played, i.e. the pocket pick when one replaced the draw */
  chart: EligibleChart;
  key: SmxChartKey;
}

/**
 * What it takes to find a chart's plays in the feed, or undefined when the
 * chart didn't come from SMX data (no `saIndex` to match a song by).
 *
 * A drawn chart keeps its difficulty's color rather than its key, and that
 * color comes straight out of the game data's difficulty list, so the same list
 * reads the class back out.
 */
export function smxChartKey(
  chart: EligibleChart,
  gameData: GameData,
): SmxChartKey | undefined {
  const songId = chart.song.saIndex;
  if (!songId) {
    return undefined;
  }
  return {
    songId,
    diffClass: gameData.meta.difficulties.find(
      (d) => d.color === chart.diffColor,
    )?.key,
    lvl: chart.level,
    plus: chart.flags.includes("plus"),
    editId: readExtra(chart.extras, EDIT_ID_KEY),
  };
}

/**
 * The one difficulty class the API and our game data disagree on the name of.
 * Every other class shares a name.
 */
const API_CLASS_ALIASES: Record<string, string> = { basic: "beginner" };

/** reads an API `difficulty_name` as a game-data difficulty key plus plus-ness */
function parseApiDifficulty(name: string | undefined) {
  if (!name) {
    return undefined;
  }
  const plus = name.endsWith("2");
  const base = plus ? name.slice(0, -1) : name;
  return { diffClass: API_CLASS_ALIASES[base] || base, plus };
}

function chartMeter(chart: SmxApiChart) {
  return chart.meter ?? chart.difficulty;
}

/** the API's stock charts for a song id, memoized for the life of the page */
const stockChartsBySong = new Map<string, SmxApiChart[]>();
/** the API's edit charts by share code, memoized for the life of the page */
const editChartsByCode = new Map<string, SmxApiChart | undefined>();

/**
 * Fetch (and cache) the API's stock charts for the given songs. Edits are left
 * out: a popular song can carry hundreds of published edits, and a drawn edit
 * is looked up by its share code instead.
 */
async function fetchStockCharts(songIds: string[], signal?: AbortSignal) {
  const missing = songIds.filter((id) => !stockChartsBySong.has(id));
  // a song has at most ~11 stock charts, so a handful of songs per request
  // stays comfortably under the API's 100-result cap
  for (const batch of chunk(missing, 8)) {
    const charts = await apiQuery<SmxApiChart>(
      "charts",
      {
        song_id: batch.map(Number),
        difficulty_name: { nin: ["edit"] },
        _take: MAX_TAKE,
      },
      signal,
    );
    for (const songId of batch) {
      stockChartsBySong.set(songId, []);
    }
    for (const chart of charts) {
      stockChartsBySong.get(String(chart.song_id))?.push(chart);
    }
  }
  return songIds.flatMap((id) => stockChartsBySong.get(id) || []);
}

/** Fetch (and cache) the API's edit charts for the given share codes. */
async function fetchEditChartsByCode(codes: string[]) {
  const missing = codes.filter((code) => !editChartsByCode.has(code));
  if (missing.length) {
    const { charts } = await fetchEditCharts(missing);
    for (const code of missing) {
      editChartsByCode.set(code, undefined);
    }
    for (const chart of charts) {
      editChartsByCode.set(chart.edit_display_id, chart);
    }
  }
  return codes
    .map((code) => editChartsByCode.get(code))
    .filter((chart): chart is SmxApiChart => !!chart);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** The API charts that answer to a drawn chart — usually exactly one. */
function findApiCharts(key: SmxChartKey, charts: SmxApiChart[]) {
  if (key.editId) {
    return charts.filter((c) => c.edit_display_id === key.editId);
  }
  const inSong = charts.filter(
    (c) => String(c.song_id) === key.songId && !c.edit_display_id,
  );
  const byClass = inSong.filter((c) => {
    const parsed = parseApiDifficulty(c.difficulty_name);
    return (
      !!parsed && parsed.diffClass === key.diffClass && parsed.plus === key.plus
    );
  });
  if (byClass.length || key.diffClass) {
    // a known class with nothing answering to it means the feed genuinely has
    // no such chart — team charts, which the API carries none of. Falling back
    // to the rating here would pin team plays onto a solo chart of equal level.
    return byClass;
  }
  // the drawn chart's class couldn't be named at all (custom data that recolored
  // its difficulties), so the rating is the only thing left to go on
  return inSong.filter((c) => chartMeter(c) === key.lvl);
}

export interface ResolvedCharts {
  /** api `song_chart_id` -> the drawn chart its plays should be recorded on */
  targetsByApiChart: Map<number, SmxChartTarget>;
  /**
   * drawn charts the feed can't report on. Team charts are the everyday case:
   * the API carries no team charts at all. An edit whose share code was never
   * published lands here too.
   */
  unresolved: SmxChartTarget[];
}

/** Find the API chart ids that correspond to a drawing's charts. */
export async function resolveSmxCharts(
  targets: SmxChartTarget[],
  signal?: AbortSignal,
): Promise<ResolvedCharts> {
  const editCodes = targets
    .map((t) => t.key.editId)
    .filter((code): code is string => !!code);
  const songIds = Array.from(
    new Set(targets.filter((t) => !t.key.editId).map((t) => t.key.songId)),
  );
  const charts = [
    ...(songIds.length ? await fetchStockCharts(songIds, signal) : []),
    ...(editCodes.length ? await fetchEditChartsByCode(editCodes) : []),
  ];

  const targetsByApiChart = new Map<number, SmxChartTarget>();
  const unresolved: SmxChartTarget[] = [];
  for (const target of targets) {
    const matches = findApiCharts(target.key, charts);
    if (!matches.length) {
      unresolved.push(target);
      continue;
    }
    for (const match of matches) {
      targetsByApiChart.set(match.id, target);
    }
  }
  return { targetsByApiChart, unresolved };
}

/** a play from the global feed, on one of the drawing's charts */
export interface RecentPlay {
  /** the score record's own id */
  id: number;
  /** the gamer tag on the play, empty when the feed didn't name one */
  username: string;
  gamerId: number | undefined;
  score: number;
  fullCombo: boolean;
  /** epoch ms the play was recorded, when the feed says */
  playedAt: number | undefined;
  /** the drawn chart this play counts for */
  target: SmxChartTarget;
}

/**
 * Timestamps come back as ISO 8601. A value with no zone is read as UTC, which
 * is what the API documents; a space instead of a `T` is tolerated because
 * `Date.parse` handles that inconsistently across engines.
 */
function parseApiTime(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  let normalized = value.replace(" ", "T");
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)) {
    normalized += "Z";
  }
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Recent plays on the resolved charts, newest first. */
export async function fetchRecentPlays(
  resolved: ResolvedCharts,
  sinceMs: number,
  signal?: AbortSignal,
): Promise<RecentPlay[]> {
  const apiChartIds = Array.from(resolved.targetsByApiChart.keys());
  if (!apiChartIds.length) {
    return [];
  }

  const plays: RecentPlay[] = [];
  for (let page = 0; page < MAX_SCORE_PAGES; page++) {
    const scores = await apiQuery<SmxApiScore>(
      "scores",
      {
        song_chart_id: apiChartIds,
        created_at: { gte: new Date(sinceMs).toISOString() },
        _take: MAX_TAKE,
        _skip: page * MAX_TAKE,
      },
      signal,
    );
    for (const score of scores) {
      const target = resolved.targetsByApiChart.get(score.song_chart_id);
      if (!target) {
        continue;
      }
      plays.push({
        id: score.id,
        username: score.gamer?.username?.trim() || "",
        gamerId: score.gamer?.id ?? score.gamer_id,
        score: score.score,
        fullCombo: !!score.full_combo,
        playedAt: parseApiTime(score.created_at ?? score.updated_at),
        target,
      });
    }
    if (scores.length < MAX_TAKE) {
      break;
    }
  }

  return plays.sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0));
}

/** strips case, spacing and punctuation so display names compare loosely */
export function normalizeHandle(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The entrant a feed username most likely belongs to, or undefined when
 * nothing answers or more than one does. `linkedUsernames` maps a normalized
 * player name to the tag confirmed for them in an earlier import, which beats
 * any guess made from the name itself.
 */
export function matchUsernameToPlayer(
  username: string,
  players: Player[],
  linkedUsernames: Readonly<Record<string, string>>,
): string | undefined {
  const handle = normalizeHandle(username);
  if (!handle) {
    return undefined;
  }

  const linked = players.filter((p) => {
    const known = linkedUsernames[normalizeHandle(p.name)];
    return known && normalizeHandle(known) === handle;
  });
  if (linked.length === 1) {
    return linked[0].id;
  }

  const named = players.map((p) => ({ p, handle: normalizeHandle(p.name) }));
  const exact = named.filter((n) => n.handle && n.handle === handle);
  if (exact.length === 1) {
    return exact[0].p.id;
  }

  // a tag that contains the other, e.g. "Auby" recorded as "AubyTheGreat"
  const partial = named.filter(
    (n) =>
      n.handle.length > 2 &&
      (n.handle.includes(handle) || handle.includes(n.handle)),
  );
  if (partial.length === 1) {
    return partial[0].p.id;
  }
  return undefined;
}

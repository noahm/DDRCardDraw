import { Chart, GameData } from "../models/SongData";

/**
 * Imports StepManiaX edit charts (shared via urls like
 * https://edits.stepmaniax.com/Z8Z-W77) and grafts them onto a clone of the
 * stock SMX data so tournament organizers can draw from a curated set of edits
 * alongside the official catalog.
 *
 * Edit metadata is sourced from the community API at api.smx.573.no, which
 * accepts an array of `edit_display_id` values for batch lookup.
 */

const API_URL = "https://api.smx.573.no/charts";

/**
 * Keys under which SMX edit-chart metadata is stashed in a chart's generic
 * `extras` array (as `${key}:value`). The SMX card variant reads these back out
 * via `readExtra`; keeping them out of the schema avoids embedding a
 * game-specific concept into the otherwise game-agnostic chart model.
 */
export const EDIT_ID_KEY = "editId";
export const EDIT_AUTHOR_KEY = "editAuthor";
/**
 * How many edit codes to request per call. Capped at 100 for two reasons:
 * the API returns at most 100 results per request (`_take`), and batching keeps
 * the request URL short — 100 codes is a ~1.7KB url, well under any server/proxy
 * length limit, so an arbitrarily long paste stays safe. Don't raise this past
 * 100 without revisiting both constraints.
 */
const MAX_BATCH = 100;

/** shape of the chart objects returned by the smx.573.no charts endpoint */
interface ApiEditChart {
  edit_display_id: string;
  edit_author: string | null;
  edit_style: string;
  difficulty: number;
  meter: number;
  song_id: number;
}

export interface FetchEditsResult {
  charts: ApiEditChart[];
  /** codes that were requested but had no matching published edit */
  notFound: string[];
}

export interface BuildResult {
  data: GameData;
  /** number of edit charts successfully grafted onto a song */
  matched: number;
  /** edit codes whose song isn't present in the stock SMX data */
  unknownSongs: string[];
}

/**
 * Scrape edit codes out of arbitrary pasted text (full urls, bare codes, or any
 * mix of comma/space/newline separated values). Codes look like `Z8Z-W77`.
 */
export function parseEditCodes(text: string): string[] {
  const matches = text.toUpperCase().match(/[A-Z0-9]{3}-[A-Z0-9]{3}/g) || [];
  return Array.from(new Set(matches));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Look up edit chart metadata for a list of edit codes, batching as needed. */
export async function fetchEditCharts(
  codes: string[],
): Promise<FetchEditsResult> {
  const charts: ApiEditChart[] = [];
  for (const batch of chunk(codes, MAX_BATCH)) {
    const q = JSON.stringify({
      edit_display_id: batch,
      _take: MAX_BATCH,
    });
    const res = await fetch(`${API_URL}?q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      throw new Error(`SMX API request failed with status ${res.status}`);
    }
    const batchCharts: ApiEditChart[] = await res.json();
    charts.push(...batchCharts);
  }

  const found = new Set(charts.map((c) => c.edit_display_id));
  const notFound = codes.filter((code) => !found.has(code));
  return { charts, notFound };
}

/**
 * Clone the stock SMX data and graft the given edit charts onto their matching
 * songs (matched by `saIndex` === the API's `song_id`). Returns the new data
 * file plus a report of what couldn't be matched.
 */
export function buildEditDataFile(
  base: GameData,
  charts: ApiEditChart[],
  name: string,
): BuildResult {
  const data: GameData = structuredClone(base);
  data.i18n.en.name = name;
  data.meta.cardVariant = "smx";

  // register the "edit" difficulty class (absent from stock SMX data)
  if (!data.meta.difficulties.some((d) => d.key === "edit")) {
    data.meta.difficulties.push({ key: "edit", color: "#7b7b7b" });
  }
  // select edits by default, since that's the point of this data set
  if (!data.defaults.difficulties.includes("edit")) {
    data.defaults.difficulties.push("edit");
  }
  const en = data.i18n.en as Record<string, unknown>;
  en.edit = "Edit";
  const abbr = (en.$abbr || (en.$abbr = {})) as Record<string, unknown>;
  abbr.edit = "Edit";
  // label for the per-card "bookmark this edit" action (see the smx card variant).
  // a partial `ja` dict is fine: other keys fall back to `en` in the provider.
  en.bookmarkEdit = "QR code bookmark link";
  const ja = (data.i18n.ja || (data.i18n.ja = {})) as Record<string, unknown>;
  ja.bookmarkEdit = "QRコードのブックマークリンク";

  const songsByIndex = new Map(data.songs.map((s) => [s.saIndex, s]));

  let matched = 0;
  const unknownSongs: string[] = [];
  for (const chart of charts) {
    const song = songsByIndex.get(String(chart.song_id));
    if (!song) {
      unknownSongs.push(chart.edit_display_id);
      continue;
    }
    const extras = [`${EDIT_ID_KEY}:${chart.edit_display_id}`];
    if (chart.edit_author) {
      extras.push(`${EDIT_AUTHOR_KEY}:${chart.edit_author}`);
    }
    const newChart: Chart = {
      style: chart.edit_style === "team" ? "team" : "solo",
      diffClass: "edit",
      lvl: chart.meter ?? chart.difficulty,
      extras,
    };
    song.charts.push(newChart);
    matched++;
  }

  return { data, matched, unknownSongs };
}

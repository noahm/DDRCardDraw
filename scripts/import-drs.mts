/**
 * Script to import DANCERUSH STARDOM song data from Konami's official
 * e-amusement music list (https://p.eagate.573.jp/game/dan/1st/music/entrance.html).
 *
 * The music list page loads its data from a public JSON endpoint (no login
 * required). This merges that list into the existing, hand-curated drs.json:
 * official ids, titles, artists, BPMs, levels, lock status and jackets come
 * from Konami; translations, folders and the remaining flags are kept as-is.
 * Songs missing from the official list (removed songs, region exclusives,
 * some event unlocks) are kept untouched and listed in the report.
 */
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import task from "tasuku";

import {
  downloadJacket,
  reportQueueStatusLive,
  requestQueue,
  writeJsonData,
} from "./utils.mts";
import type { Chart, GameData, Song } from "../src/models/SongData.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GET_IMAGES = true;

/**
 * When true, the `unlock`/`tempUnlock` flags of officially listed songs follow
 * the official lock status: songs Konami has made playable from the start lose
 * them, and locked songs get `unlock`, or `tempUnlock` if listed in
 * `TEMP_UNLOCKS`.
 */
const SYNC_LOCK_FLAGS = true;

/**
 * Locked songs that can no longer be unlocked: their event is over and they
 * were never made purchasable with stars, so only players who unlocked them
 * during the event can play them. The official list only says whether a song
 * is locked, so this is curated by hand from https://remywiki.com/AC_DRS.
 * Every other locked song is assumed to be purchasable with stars.
 */
const TEMP_UNLOCKS: Record<string, string> = {
  // Stamp Bonus, February 10th to March 2nd, 2025
  b81ecb4793b1ccb8f5067beefccbb865: "Stay Alone",
};

const DATA_URL =
  "https://p.eagate.573.jp/game/dan/1st/json/musiclist_getdata.html";
const JACKET_URL = "https://p.eagate.573.jp/game/dan/1st/img/jacket.html?c=";
const OUTPUT_PATH = resolve(__dirname, "../src/songs/drs.json");
const DEFAULT_FOLDER = "DANCERUSH STARDOM";

/**
 * Existing song names that are typos of the official title, mapped to the
 * official title. Only needed until a song has picked up its `saIndex`.
 */
const TITLE_ALIASES: Record<string, string> = {
  "Keiko my Love)": "Keiko my love",
  "Starnormal Kiss": "Starlight Kiss",
};

/** bit positions of `info.genre`, per the genre pulldown on the music page */
const GENRE_BIT = {
  license: 0,
  lesson: 1,
  recommended: 2,
  pops: 3,
  edm: 4,
  spinnin: 5,
  bemani: 6,
} as const;

/** `info.limitation_type` below this shows a lock icon on the music page */
const LIMITATION_UNLOCKED = 3;

/** flags meaning a song must be unlocked before it can be played */
const LOCK_FLAGS = ["unlock", "tempUnlock"];

interface OfficialChart {
  difnum: string;
  playable: string;
}

interface OfficialSong {
  info: {
    music_id: string;
    title_name: string;
    title_yomigana: string;
    artist_name: string;
    artist_yomigana?: string;
    bpm_max: string;
    bpm_min: string;
    limitation_type: string;
    genre: string;
    play_video_flags: string;
    license?: string;
  };
  difficulty: {
    /** single player, basic (our "easy") */
    fumen_1b: OfficialChart | null;
    /** single player, advanced (our "normal") */
    fumen_1a: OfficialChart | null;
    /** two player charts, always the same levels as single so far */
    fumen_2b: OfficialChart | null;
    fumen_2a: OfficialChart | null;
  };
}

/** loose comparison key for titles and artists */
function normalize(str: string): string {
  return str
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s'"`‘’“”]/g, "")
    .replace(/×/g, "x")
    .replace(/[〜～]/g, "~")
    .replace(/[–—]/g, "-");
}

/**
 * collapses the doubled and full-width spaces that turn up in some
 * official titles, e.g. "Set Me Free  (Hommarju Remix)"
 */
function cleanText(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

function hasGenre(song: OfficialSong, bit: number) {
  return ((Number(song.info.genre) >> bit) & 1) === 1;
}

/** lessons and the tutorial aren't real songs, and aren't in drs.json */
function isLesson(song: OfficialSong) {
  return hasGenre(song, GENRE_BIT.lesson) || Number(song.info.genre) === 0;
}

function isLocked(song: OfficialSong) {
  return Number(song.info.limitation_type) < LIMITATION_UNLOCKED;
}

/** which lock flag a locked song gets */
function lockFlag(song: OfficialSong) {
  return song.info.music_id in TEMP_UNLOCKS ? "tempUnlock" : "unlock";
}

/** bpm values are given in hundredths, e.g. "12750" is 127.5 */
function formatBpm(song: OfficialSong): string {
  const min = Number(song.info.bpm_min) / 100;
  const max = Number(song.info.bpm_max) / 100;
  if (!min && !max) return "";
  return min === max || !min ? `${max}` : `${min}-${max}`;
}

function extractCharts(song: OfficialSong): Chart[] {
  const charts: Chart[] = [];
  for (const [key, diffClass] of [
    ["fumen_1b", "easy"],
    ["fumen_1a", "normal"],
  ] as const) {
    const chart = song.difficulty[key];
    if (chart && chart.playable === "1") {
      charts.push({ lvl: Number(chart.difnum), style: "single", diffClass });
    }
  }
  return charts;
}

/** fixes flags like `["stream, removed"]` or `[" "]` left by hand edits */
function cleanFlags(flags: string[] | undefined): string[] {
  const cleaned = (flags ?? []).flatMap((flag) =>
    flag
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean),
  );
  return Array.from(new Set(cleaned));
}

function chartsLabel(charts: Chart[]) {
  return charts.map((c) => `${c.diffClass} ${c.lvl}`).join(", ");
}

function songLabel(song: Pick<Song, "name" | "artist">) {
  return `${song.name} / ${song.artist}`;
}

/**
 * Picks which of several existing copies of one official song to keep:
 * a copy whose lock/removed flags agree with the official list beats one
 * that doesn't, then the copy with more hand-curated fields wins.
 */
function pickPrimary(copies: Song[], official: OfficialSong): Song {
  const locked = isLocked(official);
  const score = (song: Song) => {
    const flags = cleanFlags(song.flags);
    let s = 0;
    if (!flags.includes("removed")) s += 4;
    if (flags.some((f) => LOCK_FLAGS.includes(f)) === locked) s += 2;
    if (song.name_translation) s += 0.5;
    if (song.artist_translation) s += 0.5;
    return s;
  };
  return copies.reduce((best, song) =>
    score(song) > score(best) ? song : best,
  );
}

interface Report {
  matched: string[];
  added: string[];
  unmatched: string[];
  skippedLessons: string[];
  duplicatesMerged: string[];
  renamed: string[];
  levelChanges: string[];
  flagChanges: string[];
}

function mergeSong(
  copies: Song[],
  official: OfficialSong,
  report: Report,
): Song {
  const existing = pickPrimary(copies, official);
  const label = songLabel(existing);
  const name = cleanText(official.info.title_name);
  const artist = cleanText(official.info.artist_name);

  if (copies.length > 1) {
    const describe = (song: Song) =>
      JSON.stringify({
        name: song.name,
        flags: song.flags ?? [],
        charts: chartsLabel(song.charts),
        name_translation: song.name_translation,
        artist_translation: song.artist_translation,
      });
    const dropped = copies.filter((c) => c !== existing).map(describe);
    report.duplicatesMerged.push(
      `${label}: kept ${describe(existing)}, dropped ${dropped.join("; ")}`,
    );
  }
  if (existing.name !== name || existing.artist !== artist) {
    report.renamed.push(`${label} -> ${name} / ${artist}`);
  }

  const charts = extractCharts(official);
  const oldCharts = chartsLabel(existing.charts);
  const newCharts = chartsLabel(charts);
  if (oldCharts !== newCharts) {
    report.levelChanges.push(`${name}: ${oldCharts} -> ${newCharts}`);
  }

  const oldFlags = existing.flags ?? [];
  let flags = cleanFlags(oldFlags);
  // an officially listed song is playable, so it can't have been removed
  flags = flags.filter((f) => f !== "removed");
  if (SYNC_LOCK_FLAGS) {
    flags = flags.filter((f) => !LOCK_FLAGS.includes(f));
    if (isLocked(official)) {
      flags.push(lockFlag(official));
    }
  }
  if (JSON.stringify(oldFlags) !== JSON.stringify(flags)) {
    report.flagChanges.push(
      `${name}: ${JSON.stringify(oldFlags)} -> ${JSON.stringify(flags)}`,
    );
  }

  return buildSong(official, {
    name_translation:
      existing.name_translation ??
      copies.find((c) => c.name_translation)?.name_translation,
    artist_translation:
      existing.artist_translation ??
      copies.find((c) => c.artist_translation)?.artist_translation,
    folder: existing.folder,
    flags,
    charts,
    rest: existing,
  });
}

function buildSong(
  official: OfficialSong,
  curated: {
    name_translation?: string;
    artist_translation?: string;
    folder?: string;
    flags: string[];
    charts: Chart[];
    rest?: Song;
  },
): Song {
  const {
    name: _name,
    name_translation: _nameTranslation,
    artist: _artist,
    artist_translation: _artistTranslation,
    saIndex: _saIndex,
    jacket: _jacket,
    bpm: _bpm,
    folder: _folder,
    flags: _flags,
    charts: _charts,
    ...rest
  } = curated.rest ?? ({} as Partial<Song>);

  const id = official.info.music_id;
  let jacket = `drs/${id}.jpg`;
  if (GET_IMAGES) {
    jacket = downloadJacket(`${JACKET_URL}${id}`, `drs/${id}`);
  }

  // hand-curated fields sit next to the official ones they describe
  return {
    name: cleanText(official.info.title_name),
    ...(curated.name_translation && {
      name_translation: curated.name_translation,
    }),
    artist: cleanText(official.info.artist_name),
    ...(curated.artist_translation && {
      artist_translation: curated.artist_translation,
    }),
    saIndex: id,
    jacket,
    bpm: formatBpm(official),
    folder: curated.folder ?? DEFAULT_FOLDER,
    ...(curated.flags.length && { flags: curated.flags }),
    // keep any other hand-curated fields
    ...rest,
    charts: curated.charts,
  };
}

/** finds the official song matching an existing one, if any */
function findOfficial(
  song: Song,
  byId: Map<string, OfficialSong>,
  byTitle: Map<string, OfficialSong[]>,
): OfficialSong | undefined {
  if (song.saIndex && byId.has(song.saIndex)) {
    return byId.get(song.saIndex);
  }
  const title = TITLE_ALIASES[song.name] ?? song.name;
  const candidates = byTitle.get(normalize(title)) ?? [];
  if (candidates.length <= 1) return candidates[0];
  // several songs share the title (e.g. "Touch Me"), so the artist decides
  const artist = normalize(song.artist);
  const byArtist = candidates.filter(
    (c) => normalize(c.info.artist_name) === artist,
  );
  return byArtist.length === 1 ? byArtist[0] : undefined;
}

let report: Report | undefined;

const importTask = await task(
  "Import DANCERUSH STARDOM",
  async ({ setStatus, setError, task }) => {
    const cleanup = reportQueueStatusLive(task);
    try {
      const existingData: GameData = JSON.parse(
        await readFile(OUTPUT_PATH, { encoding: "utf-8" }),
      );

      setStatus("Fetching music list from e-amusement...");
      const res = await fetch(DATA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ service_kind: "music_list" }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        throw new Error(`e-amusement returned ${res.status} ${res.statusText}`);
      }
      const body = (await res.json()) as { musiclist?: OfficialSong[] };
      if (!body.musiclist?.length) {
        throw new Error("e-amusement returned no music list");
      }

      const thisReport: Report = {
        matched: [],
        added: [],
        unmatched: [],
        skippedLessons: [],
        duplicatesMerged: [],
        renamed: [],
        levelChanges: [],
        flagChanges: [],
      };

      const officialSongs: OfficialSong[] = [];
      for (const song of body.musiclist) {
        if (isLesson(song)) {
          thisReport.skippedLessons.push(song.info.title_name);
        } else {
          officialSongs.push(song);
        }
      }
      setStatus(
        `Fetched ${officialSongs.length} songs (+${thisReport.skippedLessons.length} lessons) from e-amusement`,
      );

      const byId = new Map(officialSongs.map((s) => [s.info.music_id, s]));
      const byTitle = new Map<string, OfficialSong[]>();
      for (const song of officialSongs) {
        const key = normalize(song.info.title_name);
        byTitle.set(key, [...(byTitle.get(key) ?? []), song]);
      }

      // group existing songs by the official song they match
      const copiesById = new Map<string, Song[]>();
      const matchOf = new Map<Song, OfficialSong>();
      for (const song of existingData.songs) {
        const official = findOfficial(song, byId, byTitle);
        if (!official) continue;
        matchOf.set(song, official);
        const id = official.info.music_id;
        copiesById.set(id, [...(copiesById.get(id) ?? []), song]);
      }

      // keep file order: each official song replaces its first existing copy
      const songs: Song[] = [];
      for (const song of existingData.songs) {
        const official = matchOf.get(song);
        if (!official) {
          thisReport.unmatched.push(
            `${songLabel(song)} ${JSON.stringify(song.flags ?? [])}`,
          );
          songs.push(song);
          continue;
        }
        const copies = copiesById.get(official.info.music_id)!;
        if (copies[0] !== song) continue;
        thisReport.matched.push(official.info.title_name);
        songs.push(mergeSong(copies, official, thisReport));
      }

      for (const official of officialSongs) {
        if (copiesById.has(official.info.music_id)) continue;
        const song = buildSong(official, {
          flags: isLocked(official) ? [lockFlag(official)] : [],
          charts: extractCharts(official),
        });
        thisReport.added.push(
          `${songLabel(song)} (${chartsLabel(song.charts)}${isLocked(official) ? ", locked" : ""})`,
        );
        songs.push(song);
      }

      setStatus("Writing JSON output...");
      await writeJsonData({ ...existingData, songs }, OUTPUT_PATH);

      if (requestQueue.size || requestQueue.pending) {
        setStatus("Waiting for jacket downloads to finish...");
        await requestQueue.onIdle();
      }
      report = thisReport;
      setStatus("Done!");
    } catch (e) {
      setError(e as Error);
    } finally {
      cleanup();
    }
  },
);

if (report) {
  // stop tasuku re-rendering over the report
  importTask.clear();
  const section = (title: string, lines: string[], showLines = true) => {
    console.log(`\n${title}: ${lines.length}`);
    if (showLines) {
      for (const line of lines) console.log(`  ${line}`);
    }
  };
  section("Songs matched to the official list", report.matched, false);
  section("New songs added", report.added);
  section("Existing songs with no official match (kept)", report.unmatched);
  section("Lessons/tutorial skipped", report.skippedLessons, false);
  section("Duplicate entries merged", report.duplicatesMerged);
  section("Names/artists corrected", report.renamed);
  section("Levels changed", report.levelChanges);
  section("Flags changed", report.flagChanges);
}

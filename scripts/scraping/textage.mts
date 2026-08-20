import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import iconv from "iconv-lite";
import { parseStringPromise } from "xml2js";
import { decode as decodeHTML } from "html-entities";

import type { Song } from "../../src/models/SongData.ts";
import { exists, type SongImporter } from "../utils.mts";

// textage JS files (c) textage.cc - don't distribute them after downloading!

const textageFiles = [
  "titletbl",
  "actbl",
  //"cstbl",
  //"cstbl1",
  //"cstbl2",
  //"cltbl",
  //"stepup",
  "datatbl",
  "scrlist",
] as const;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const textageDir = path.join(__dirname, "textage");
const textageMetaPath = path.join(textageDir, "textage-meta.json");
console.log(textageDir);

const chartSlot = [
  { style: "", diffClass: "" },
  { style: "single", diffClass: "beginner" },
  { style: "single", diffClass: "normal" },
  { style: "single", diffClass: "hyper" },
  { style: "single", diffClass: "another" },
  { style: "single", diffClass: "leggendaria" },
  { style: "double", diffClass: "beginner" },
  { style: "double", diffClass: "normal" },
  { style: "double", diffClass: "hyper" },
  { style: "double", diffClass: "another" },
  { style: "double", diffClass: "leggendaria" },
] as const;

const folderNames = [
  "INF etc.",
  "1st style",
  "2nd style",
  "3rd style",
  "4th style",
  "5th style",
  "6th style",
  "7th style",
  "8th style",
  "9th style",
  "10th style",
  "IIDX RED",
  "HAPPY SKY",
  "DistorteD",
  "GOLD",
  "DJ TROOPERS",
  "EMPRESS",
  "SIRIUS",
  "Resort Anthem",
  "Lincle",
  "tricoro",
  "SPADA",
  "PENDUAL",
  "copula",
  "SINOBUZ",
  "CANNON BALLERS",
  "Rootage",
  "HEROIC VERSE",
  "BISTROVER",
  "CastHour",
  "RESIDENT",
  "EPOLIS",
  "Pinky Crush",
  "Sparkle Shower",
  "---",
  "substream",
] as const;

const timelockTags = new Set<SongTag>(["a_minstr", "advanc32"]);

const timelockLegs = new Set<SongTag>([
  "smooooch",
  "script_n",
  "script_h",
  "alba",
  "bitchoco",
  "_casino",
  "lightstr",
  "overtime",
  "selfishs",
  "lab",
  "plkmania",
  "_3plus3",
  "a_minstr",
  "cuerscue",
  "high",
  "_kagachi",
  "hyena",
  "call",
  "bowshock",
  "_ope_143",
  "_therele",
  "punch_lv",
  "chaserxx",
  "braveout",
  "inazuma",
  "_seijin",
  "nbtheory",
  "_hrenten",
  "implant",
]);

const eventReleases = new Set<SongTag>([
  "ccrimson",
  "max_360",
  "suspcion",
  "psychint",
]);

const eventFlagMap = new Map<string, string[]>([
  ["ピンキージャンプアップ！", ["pinkyJumpUp"]],
  ["PINKY EXTRA CHALLENGE", ["pinkyExtraChallenge"]],
  ["ピンキーアンダーグラウンド", ["pinkyUnderground"]],
  ["Triple Tribe", ["tripleTribe"]],
  ["ULTIMATE MOBILE アーケード連動", ["ultimateMobile"]],
  ["WORLD TOURISM", ["worldTourism"]],
]);

type SongTag = string;

/** Schema for titletbl on titletbl.js */
type TextageTitleRow = [
  /** Folder index (see `folderNames`) */
  folder: number,
  /** Song ID? (unused) */
  id: number,
  options: number,
  genre: string,
  artist: string,
  title: string,
  subtitle?: string,
];

type TextageActRow = [
  acFlag: number,
  spBegOldLevel: number,
  spBegOldFlag: number,
  spBegLevel: number,
  spBegFlag: number,
  spNorLevel: number,
  spNorFlag: number,
  spHypLevel: number,
  spHypFlag: number,
  spAnoLevel: number,
  spAnoFlag: number,
  spLegLevel: number,
  spLegFlag: number,
  dpBegLevel: number,
  dpBegFlag: number,
  dpNorLevel: number,
  dpNorFlag: number,
  dpHypLevel: number,
  dpHypFlag: number,
  dpAnoLevel: number,
  dpAnoFlag: number,
  dpLegLevel: number,
  dpLegFlag: number,
  ...rest: Array<number | string>,
];

type TextageDataRow = [
  /** SP/BEGINNER notes */
  sb: number,
  /** SP/NORMAL notes */
  sn: number,
  /** SP/HYPER notes */
  sh: number,
  /** SP/ANOTHER notes */
  sa: number,
  /** SP/LEGGENDARIA notes */
  sl: number,
  /** DP/BEGINNER notes */
  db: number,
  /** DP/NORMAL notes */
  dn: number,
  /** DP/HYPER notes */
  dh: number,
  /** DP/ANOTHER notes */
  da: number,
  /** DP/LEGGENDARIA notes */
  dl: number,
  unknown: number,
  bpm: string,
];

type TextageContext = {
  titletbl: Record<SongTag, TextageTitleRow>;
  actbl: Record<SongTag, TextageActRow>;
  datatbl: Record<SongTag, TextageDataRow>;
  eventMap: [eventName: string, songTags: SongTag[]][];
  getLevel: (tag: SongTag, type: number, num: number) => number;
  getBpm: (tag: SongTag, type: number) => string;
  getCellData: (tag: SongTag, type: number) => string;
};

function getChartStatusFlags(
  songTag: SongTag,
  type: number,
  getLevel: (tag: SongTag, type: number, num: number) => number,
): string[] {
  // Status bits (from get_level):
  // 0x02: Level rate is 1 to 12
  // 0x04: Includes arcade version
  // 0x08: Has CN or BSS (includes HELL-CHARGE)
  const status = getLevel(songTag, type, 2);
  const flags: string[] = [];

  if (!(status & 0x08)) {
    return flags;
  }

  const textageGlobal = globalThis as typeof globalThis & {
    get_sdata?: (tag: SongTag, type: number) => string;
  };
  const renderedCell = textageGlobal.get_sdata?.(songTag, type) ?? "";

  if (/border:\s*1px\s*red\s*solid/i.test(renderedCell)) {
    // HELL-CHARGE
    flags.push("hellCharge");
  } else if (/border:\s*1px\s*gray\s*solid/i.test(renderedCell)) {
    // NORMAL CN or BSS
  }

  return flags;
}

type TextageSong = {
  name: string;
  artist: string;
  genre: string;
  saHash: SongTag;
  bpm: string;
  folder: string;
  jacket: string;
  flags?: string[];
  charts: TextageSongChart[];
};

type TextageSongChart = {
  style: string;
  diffClass: string;
  lvl: number;
  bpm?: string;
  flags?: string[];
  maxScore?: number;
};

export class TextageSongImporter implements SongImporter<TextageSong> {
  #force: boolean;
  #prepared: boolean | null = null;
  #lastUpdated: number | null = null;

  static #textageJsPath(fn: (typeof textageFiles)[number]) {
    return path.join(textageDir, `${fn}.js`);
  }

  static #textageMjsPath(fn: (typeof textageFiles)[number]) {
    return path.join(textageDir, `${fn}.mjs`);
  }

  static #convertTextageSourceToMjs(
    fn: (typeof textageFiles)[number],
    source: string,
  ) {
    const encodedSource = JSON.stringify(source)
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");

    return `// Auto-generated from ${fn}.js by scripts/scraping/textage.mjs.
// textage JS files (c) textage.cc - don't distribute them after downloading!

import { runInThisContext } from "node:vm";

const textageSource = ${encodedSource};

// Execute as a classic script so legacy globals/functions become available on globalThis.
runInThisContext(textageSource, { filename: ${JSON.stringify(`${fn}.js`)} });

export default globalThis;
`;
  }

  static #getCacheBustSuffix(force: boolean) {
    return force ? `?v=${Date.now()}` : "";
  }

  /**
   * @param {boolean} force redownload and regenerate source files
   */
  constructor(force: boolean = false) {
    this.#force = force;
  }

  async #setupTextageRuntimeGlobals() {
    const g = globalThis as unknown as Record<string, unknown>;

    g.window ||= globalThis;
    g.self ||= globalThis;
    g.location ||= {
      href: "https://textage.cc/score/",
      search: "",
      hash: "",
      pathname: "/score/",
    };
    g.navigator ||= {
      userAgent: "node",
      language: "ja",
    };
    g.document ||= {
      cookie: "",
      ref: {
        tbox: { value: "" },
        gen: { checked: false },
        tit: { checked: false },
        art: { checked: false },
        djauto: { value: "" },
        djauto_opt: { value: 104 },
      },
      write: () => {},
      createElement: () => ({ style: {}, appendChild: () => {} }),
      getElementById: () => ({ style: {}, innerHTML: "", value: "" }),
    };
    g.confirm ||= () => false;
    g.alert ||= () => {};
  }

  async #unwrapHTML(s: string): Promise<string> {
    s = s
      .replaceAll("<br>", "\n")
      .replaceAll("&", "&amp;")
      .replaceAll("ltmodel", `"ltmodel"`);
    return parseStringPromise(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><root>` +
        s +
        `</root>`,
    ).then((v: Record<string, unknown>) => {
      let vInner = JSON.parse(JSON.stringify(v));
      let nested = true;
      while (nested) {
        nested = false;
        for (const innerTag of ["span", "font", "div", "root", "_"]) {
          if (vInner[innerTag]) {
            vInner = vInner[innerTag];
            nested = true;
          }
        }
      }
      vInner = vInner[0]?._ || vInner;
      return decodeHTML(vInner.trim());
    });
  }

  async #textageDL(force = false): Promise<boolean> {
    const textageJsReady = await Promise.all(
      textageFiles.map((fn) => exists(TextageSongImporter.#textageJsPath(fn))),
    ).then((a) => a.every((v) => v));

    if (force || !textageJsReady) {
      console.log("Redownloading source JS from textage...");
      if (await exists(textageDir)) {
        await rm(textageDir, { recursive: true, force: true });
      }
      await mkdir(textageDir).catch(() => {});

      for (const fn of textageFiles) {
        console.log(`Downloading ${fn}...`);

        const res = await fetch(`https://textage.cc/score/${fn}.js`);
        if (!res.ok || !res.body) {
          throw new Error(`Failed to download ${fn}.js (${res.status})`);
        }

        const writer = createWriteStream(
          TextageSongImporter.#textageJsPath(fn),
        );
        const stream = Readable.fromWeb(res.body);
        stream
          .pipe(iconv.decodeStream("shift-jis"))
          .pipe(iconv.encodeStream("utf-8"))
          .pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on("error", reject);
          stream.on("error", reject);
          writer.on("finish", resolve);
        });
      }

      const textageJsSuccess = await Promise.all(
        textageFiles.map((fn) =>
          exists(TextageSongImporter.#textageJsPath(fn)),
        ),
      ).then((a) => a.every((v) => v));
      if (!textageJsSuccess) {
        console.log(
          `Failed to download textage JS sources. Invoke like 'yarn import:iidx [rescrape]'`,
        );
        return false;
      }
    } else {
      console.log("Not redownloading source JS from textage");
    }

    console.log("Converting textage JS into importable MJS files...");
    for (const fn of textageFiles) {
      const source = await readFile(TextageSongImporter.#textageJsPath(fn), {
        encoding: "utf-8",
      });
      const converted = TextageSongImporter.#convertTextageSourceToMjs(
        fn,
        source,
      );
      await writeFile(TextageSongImporter.#textageMjsPath(fn), converted, {
        encoding: "utf-8",
      });
    }

    const textageScrapeSuccess = await Promise.all(
      textageFiles.flatMap((fn) => [
        exists(TextageSongImporter.#textageJsPath(fn)),
        exists(TextageSongImporter.#textageMjsPath(fn)),
      ]),
    ).then((a) => a.every((v) => v));
    if (!textageScrapeSuccess) {
      console.log(
        `Failed to prepare textage JS/MJS sources. Invoke like 'yarn import:iidx [rescrape]'`,
      );
      return false;
    }

    const headerDates = await Promise.all(
      textageFiles.map(async (fn) => {
        const res = await fetch(`https://textage.cc/score/${fn}.js`, {
          method: "HEAD",
        }).catch(() => null);
        if (!res?.ok) {
          return 0;
        }
        const lastModified = res.headers.get("last-modified");
        const parsed = lastModified ? Date.parse(lastModified) : NaN;
        return Number.isFinite(parsed) ? parsed : 0;
      }),
    );

    const headerLastUpdated = Math.max(0, ...headerDates);
    this.#lastUpdated = headerLastUpdated;

    return true;
  }

  async #prepare() {
    this.#prepared ||= await this.#textageDL(this.#force);
    return this.#prepared;
  }

  async fetchLastUpdated(): Promise<number | null> {
    const prepared = await this.#prepare();
    if (!prepared) {
      throw new Error("textage source files are not ready");
    }
    return this.#lastUpdated;
  }

  async #loadTextageGlobals(): Promise<TextageContext> {
    const prepared = await this.#prepare();
    if (!prepared) {
      throw new Error("textage source files are not ready");
    }

    await this.#setupTextageRuntimeGlobals();

    for (const fn of textageFiles) {
      const moduleUrl = `${pathToFileURL(TextageSongImporter.#textageMjsPath(fn)).href}${TextageSongImporter.#getCacheBustSuffix(this.#force)}`;
      await import(moduleUrl);
      console.log(`${fn}.mjs imported`);
    }

    const g = globalThis as unknown as {
      titletbl?: TextageContext["titletbl"];
      actbl?: TextageContext["actbl"];
      datatbl?: TextageContext["datatbl"];
      e_list?: TextageContext["eventMap"][];
      get_level?: TextageContext["getLevel"];
      get_bpm?: TextageContext["getBpm"];
      get_sdata?: TextageContext["getCellData"];
    };

    const titletbl = g.titletbl;
    const actbl = g.actbl;
    const datatbl = g.datatbl;
    const eventMap = g.e_list?.[2];
    const getLevel = g.get_level;
    const getBpm = g.get_bpm;
    const getCellData = g.get_sdata;

    if (
      !titletbl ||
      !actbl ||
      !datatbl ||
      !eventMap ||
      !getLevel ||
      !getBpm ||
      !getCellData
    ) {
      throw new Error(
        "Failed to load textage globals from converted mjs modules",
      );
    }

    return {
      titletbl,
      actbl,
      datatbl,
      eventMap,
      getLevel,
      getBpm,
      getCellData,
    };
  }

  async fetchSongs(): Promise<TextageSong[]> {
    const {
      titletbl,
      actbl,
      datatbl,
      eventMap,
      getLevel,
      getBpm,
      getCellData,
    } = await this.#loadTextageGlobals();

    const songs: TextageSong[] = [];

    for (const [
      songTag,
      [folder, , , genre, artist, title, subtitle],
    ] of Object.entries(titletbl)) {
      try {
        if (!actbl[songTag] || (actbl[songTag][0] & 1) == 0) {
          continue;
        }

        const songBPM = datatbl[songTag][11] || "[BPM N/A]";

        let songName = decodeHTML(await this.#unwrapHTML(title), {
          scope: "strict",
        });
        if (subtitle) {
          songName +=
            " " +
            decodeHTML(await this.#unwrapHTML(subtitle), {
              scope: "strict",
            });
        }

        const chartData: TextageSongChart[] = [];
        for (const [i, slot] of chartSlot.entries()) {
          const chartLevel = getLevel(songTag, i, 1);
          if (slot.diffClass !== "" && chartLevel !== 0) {
            const noteCount = (datatbl[songTag][i] as number) ?? 0;
            const chartInfo: TextageSongChart = { ...slot, lvl: chartLevel };
            if (noteCount > 0) {
              chartInfo.maxScore = noteCount * 2;
            }
            const chartBPM = getBpm(songTag, i);
            if (chartBPM !== songBPM) {
              chartInfo.bpm = chartBPM;
            }
            const chartStatusFlags = getChartStatusFlags(songTag, i, getLevel);
            if (chartStatusFlags.length) {
              chartInfo.flags = [...chartStatusFlags];
            }
            if (slot.diffClass === "leggendaria" && timelockLegs.has(songTag)) {
              chartInfo.flags = [...(chartInfo.flags ?? []), "timelock"];
            }
            chartData.push(chartInfo);
          }
        }

        const songFlags: string[] = [];
        for (const [eventName, songTags] of eventMap) {
          if (songTags.includes(songTag) && !eventReleases.has(songTag)) {
            const relatedFlags = Array.from(eventFlagMap.entries()).filter(
              (v) => eventName.includes(v[0]),
            );
            if (relatedFlags.length === 1) {
              console.warn(
                `c[] ${songTag} (${songName}) is locked behind the ${relatedFlags[0][0]} event`,
              );
              songFlags.push(...relatedFlags[0][1]);
            } else {
              console.warn(
                `c[] ${songTag} (${songName}) is locked behind unknown event ${eventName}`,
              );
            }
          }
        }
        if (timelockTags.has(songTag)) {
          songFlags.push("timelock");
        }

        const folderName = folderNames[folder] ?? "---";
        const folderFile = folderName.replaceAll(" ", "-");

        songs.push({
          name: songName,
          artist: decodeHTML(artist || "[artist N/A]", { scope: "strict" }),
          genre: decodeHTML(genre || "[genre N/A]", { scope: "strict" }),
          saHash: songTag,
          bpm: songBPM,
          folder: folderName,
          charts: chartData,
          flags: songFlags.length ? songFlags : undefined,
          jacket: `iidx/${folderFile}.svg`,
        });
      } catch (err) {
        console.warn(`Something's up with song tag ${songTag}:\n${err}`);
      }
    }

    return songs;
  }

  merge(existingSong: Song, fetchedSong: TextageSong): boolean {
    let updated = false;

    const copiedSongKeys: Array<
      keyof Pick<
        Song,
        "name" | "artist" | "genre" | "bpm" | "jacket" | "folder" | "saHash"
      >
    > = ["name", "artist", "genre", "bpm", "jacket", "folder", "saHash"];
    for (const key of copiedSongKeys) {
      if (
        existingSong[key] !== fetchedSong[key] &&
        fetchedSong[key] !== undefined
      ) {
        existingSong[key] = fetchedSong[key] as never;
        updated = true;
      }
    }

    if (
      existingSong.flags?.join("\u0000") !== fetchedSong.flags?.join("\u0000")
    ) {
      if (fetchedSong.flags?.length) {
        existingSong.flags = [...fetchedSong.flags];
      } else {
        delete existingSong.flags;
      }
      updated = true;
    }

    for (const fetchedChart of fetchedSong.charts) {
      const existingChart = existingSong.charts.find(
        (c) =>
          c.style === fetchedChart.style &&
          c.diffClass === fetchedChart.diffClass,
      );
      if (!existingChart) {
        existingSong.charts.push({ ...fetchedChart });
        updated = true;
        continue;
      }

      if (
        existingChart.lvl !== fetchedChart.lvl ||
        existingChart.bpm !== fetchedChart.bpm ||
        existingChart.maxScore !== fetchedChart.maxScore ||
        existingChart.flags?.join("\u0000") !==
          fetchedChart.flags?.join("\u0000")
      ) {
        existingChart.lvl = fetchedChart.lvl;
        existingChart.bpm = fetchedChart.bpm;
        if (fetchedChart.maxScore !== undefined) {
          existingChart.maxScore = fetchedChart.maxScore;
        } else {
          delete existingChart.maxScore;
        }
        if (fetchedChart.flags?.length) {
          existingChart.flags = [...fetchedChart.flags];
        } else {
          delete existingChart.flags;
        }
        updated = true;
      }
    }

    return updated;
  }

  songEquals(existingSong: Song, fetchedSong: Song): boolean {
    return existingSong.saHash && fetchedSong.saHash
      ? existingSong.saHash === fetchedSong.saHash
      : existingSong.name === fetchedSong.name &&
          existingSong.artist === fetchedSong.artist;
  }
}

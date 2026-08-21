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

/**
 * Event name (from textage) to flag(s) mapping
 */
const eventFlagMap = new Map<string, string[]>([
  ["ULTIMATE MOBILE アーケード連動", ["ultimateMobile"]],
  ["Sparkle Fruit Lab.", ["sparkleFruitLab"]],
  ["WORLD TOURISM(Sparkle Shower)", ["worldTourism"]],
  ["CYBER LOADER", ["cyberLoader"]],
  ["EXTRA CHALLENGE", ["extraChallenge"]],
  ["The 4th 25周年記念イベント", ["the4th"]],
  ["秘蔵のレコード", ["shopUnlock"]],
  [
    "<span style='font-size:6pt'>BEMANI PRO LEAGUE -SEASON 4- </span>Triple Tribe",
    ["lightningModel", "tempUnlock"],
  ],
  ["BPLプロ選手サポーターズ -SEASON 5-", ["tempUnlock"]],
  [
    "<span style='font-size:6pt'>BEMANI PRO LEAGUE -SEASON 5- </span>Triple Tribe 0",
    ["tempUnlock"],
  ],
  [
    "<span style='font-size:6pt'>BEMANI PRO LEAGUE -SEASON 5- </span>Triple Tribe",
    ["tempUnlock"],
  ],
  ["Triple Tribe Append", ["tempUnlock"]],
  ["pop'n&IIDX Cheers×Cheers!!", ["tempUnlock"]],
  ["BEMANI納涼祭2026", ["tempUnlock"]],
]);
/** Battle arena unlock songs (not shown on textage) */
const battleArenaUnlocks = new Set<string>([
  "evrgreen", // evergreen
  "kyamsama", // KYAMISAMA ONEGAI!
  "acidvis", // ACID VISION
]);
/**
 * Locked [LEGGENDARIA] charts mapping
 */
const lockedLeggendaria = new Map<SongTag, string[]>([
  ...[
    "overtime", // OVER TIME
    "selfishs", // Selfish Sweet
    "lab", // LAB
    "plkmania", // POLꓘAMAИIA
    "_3plus3", // ≡＋≡
    "medilove", // Medicine of love (辻斬り隠れキャラ event)
  ].map((tag) => [tag, ["hiddenLeggendaria"]] as [string, string[]]),
  ...[
    "_mschour", // ミュージック・アワー
    "comaaaaa", // CoMAAAAAAA
    "gene", // GENE
    "_zero", // 零 - ZERO -
    "risen", // Rise'n Beauty
    "alphratz", // Alpheratz
    "urbancon", // Urban Constellations
    "proprops", // Prohibited Props
    "27thstyl", // 27th style
    "raison", // Raison d'être ～交差する宿命～
  ].map((tag) => [tag, ["battleArena"]] as [string, string[]]),
  ...[
    "idolsynd", // IDOL syndrome.
    "caldwl99", // Caldwell 99
    "cuerscue", // CUE CUE RESCUE
    "high", // HIGH
    "_kagachi", // 蛇神
    "hyena", // HYENA
    "call", // CALL
    "bowshock", // Bow shock!!
    "_ope_143", // ここからよろしく大作戦143
    "_therele", // #The_Relentless
    "punch_lv", // Punch Love ♥ 仮面
    "chaserxx", // ChaserXX
    "braveout", // BRAVE OUT
    "inazuma", // INAZUMA
    "_seijin", // 聖人の塔
    "nbtheory", // Nothing but Theory
    "_hrenten", // 烽火連天の刃
    "implant", // IMPLANTATION
    "captive", // CaptivAte～浄化～
    "gardenhs", // garden
  ].map((tag) => [tag, eventFlagMap.get("秘蔵のレコード")!] as const),
  ...[
    "lisa_ric", // Lisa-RICCIA
    "catchme", // Catch Me
    "ooo", // OOO
    "superdup", // Super Duper Racers
    "wakeupnw", // WAKE UP NOW
    "emberlts", // Ember Lights
    "_jdesire", // 純真可憐デザイア
    "flashes", // Flashes
    "mel", // Mel
    "xanadu_2", // XANADU OF TWO
    "_sheaven", // サヨナラ・ヘヴン
    "inherita", // INHERITANCE
    "time2emp", // Time To Empress
  ].map(
    (tag) => [tag, eventFlagMap.get("WORLD TOURISM(Sparkle Shower)")!] as const,
  ),
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

  #getChartStatusFlags(
    songTag: SongTag,
    type: number,
    getLevel: TextageContext["getLevel"],
    getCellData: TextageContext["getCellData"],
  ): { flags: string[]; includesArcade: boolean } {
    // Status bits (from get_level):
    // 0x02: Level rate is 1 to 12
    // 0x04: Includes arcade version
    // 0x08: Has CN or BSS (includes HELL-CHARGE)
    const status = getLevel(songTag, type, 2);
    let includesArcade = (status & 0x04) !== 0;
    const flags: string[] = [];

    if (!(status & 0x08)) {
      return { flags, includesArcade };
    }

    const renderedCell = getCellData(songTag, type) ?? "";
    // textage marks non-AC cells with class="x" in get_sdata.
    if (/class\s*=\s*x\b/i.test(renderedCell)) {
      includesArcade = false;
    }
    if (/border:\s*1px\s*red\s*solid/i.test(renderedCell)) {
      flags.push("hellCharge");
    }

    return { flags, includesArcade };
  }

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
            const { flags, includesArcade } = this.#getChartStatusFlags(
              songTag,
              i,
              getLevel,
              getCellData,
            );
            if (!includesArcade) {
              continue;
            }
            const noteCount = (datatbl[songTag][i] as number) ?? 0;
            const chartInfo: TextageSongChart = { ...slot, lvl: chartLevel };
            if (noteCount > 0) {
              chartInfo.maxScore = noteCount * 2;
            }
            const chartBPM = getBpm(songTag, i);
            if (chartBPM !== songBPM) {
              chartInfo.bpm = chartBPM;
            }
            if (slot.diffClass === "leggendaria") {
              flags.push(...(lockedLeggendaria.get(songTag) ?? []));
            }
            if (flags.length) {
              chartInfo.flags = flags;
            }
            chartData.push(chartInfo);
          }
        }

        const songFlags: string[] = [];
        for (const [eventName, songTags] of eventMap) {
          if (songTags.includes(songTag)) {
            const relatedFlags = eventFlagMap.get(eventName);
            if (relatedFlags?.length) {
              songFlags.push(...relatedFlags);
            } else {
              console.warn(
                `c[] ${songTag} (${songName}) is locked behind unknown event ${eventName}`,
              );
            }
          }
        }
        if (battleArenaUnlocks.has(songTag)) {
          songFlags.push("battleArena");
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

    // Remove any charts that are no longer present in the fetched data
    const beforeChartCount = existingSong.charts.length;
    existingSong.charts = existingSong.charts.filter((chart) =>
      fetchedSong.charts.find(
        (c) => c.style === chart.style && c.diffClass === chart.diffClass,
      ),
    );
    if (existingSong.charts.length !== beforeChartCount) {
      updated = true;
    }

    for (const fetchedChart of fetchedSong.charts) {
      const existingChart = existingSong.charts.find(
        (c) =>
          c.style === fetchedChart.style &&
          c.diffClass === fetchedChart.diffClass,
      );
      if (!existingChart) {
        console.log(
          `Added "${existingSong.name}": [${fetchedChart.style}/${fetchedChart.diffClass}] (Lv.${fetchedChart.lvl})`,
        );
        existingSong.charts.push({ ...fetchedChart });
        updated = true;
        continue;
      }

      // Update level if different
      if (existingChart.lvl !== fetchedChart.lvl) {
        console.log(
          `Updated "${existingSong.name}" [${fetchedChart.style}/${fetchedChart.diffClass}] level: ${existingChart.lvl} -> ${fetchedChart.lvl}`,
        );
        existingChart.lvl = fetchedChart.lvl;
        updated = true;
      }
      // Update BPM if different
      if (existingChart.bpm !== fetchedChart.bpm) {
        console.log(
          `Updated "${existingSong.name}" [${fetchedChart.style}/${fetchedChart.diffClass}] BPM: ${existingChart.bpm} -> ${fetchedChart.bpm}`,
        );
        existingChart.bpm = fetchedChart.bpm;
        updated = true;
      }
      // Update MAX if different
      if (
        existingChart.maxScore !== fetchedChart.maxScore &&
        fetchedChart.maxScore !== undefined
      ) {
        console.log(
          `Updated "${existingSong.name}" [${fetchedChart.style}/${fetchedChart.diffClass}] MAX: ${existingChart.maxScore} -> ${fetchedChart.maxScore}`,
        );
        existingChart.maxScore = fetchedChart.maxScore;
        updated = true;
      }

      // Update flags if different
      if (
        !fetchedChart.maxScore &&
        existingChart.flags?.includes("hellCharge") &&
        !fetchedChart.flags?.includes("hellCharge")
      ) {
        // Keep manual hellCharge when textage has no chart detail to confirm status.
        fetchedChart.flags = [...(fetchedChart.flags ?? []), "hellCharge"];
      }
      if (
        existingChart.flags?.join("\u0000") !==
        fetchedChart.flags?.join("\u0000")
      ) {
        console.log(
          `Updated "${existingSong.name}" [${fetchedChart.style}/${fetchedChart.diffClass}] flags: ${existingChart.flags} -> ${fetchedChart.flags}`,
        );
        if (fetchedChart.flags?.length) {
          existingChart.flags = fetchedChart.flags;
        } else {
          delete existingChart.flags;
        }
        updated = true;
      }

      if (!existingChart.maxScore) {
        const chartName =
          `[${existingChart.style}/${existingChart.diffClass}]`.toUpperCase();
        console.warn(
          `c[] ${existingSong.name} (${existingSong.saHash}) ${chartName}: no notes info`,
        );
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

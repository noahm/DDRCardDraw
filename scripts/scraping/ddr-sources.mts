import * as path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

import type { Chart, GameData, Song } from "../../src/models/SongData.ts";

/** Interface for importing DDR songs from a source */
export interface DDRSongImporter<T extends Partial<Song>> {
  /** Fetches songs from the source */
  fetchSongs(): Promise<T[]>;

  /**
   * Compares two song objects for equality
   * @param existingSong Existing song in the database
   * @param fetchedSong Newly fetched song from the source
   * @returns True if songs are considered equal
   */
  songEquals(existingSong: Song, fetchedSong: T): boolean;

  /**
   * Merges data from an `fetchedSong` into `existingSong` object.
   * @summary This function with side effects that change `existingSong` object
   * @param existingSong Existing song object to update
   * @param fetchedSong Newly fetched song from the source
   * @returns True if the merge resulted in any updates
   */
  merge(existingSong: Song, fetchedSong: T): boolean | Promise<boolean>;
}

type KeyOfSong = keyof Song | `charts.${keyof Chart}`;

/**
 * DDR song importer that imports from a local JSON file.
 * Useful for importing from other DDR mixes' JSON data.
 */
export class JsonDDRSongImporter implements DDRSongImporter<Song> {
  readonly #jsonFileName: `${string}.json`;
  readonly #updatedPropertyKeys: readonly KeyOfSong[];
  readonly #overwriteProperties: readonly KeyOfSong[];

  /**
   * @param jsonFileName The name of the JSON file to import songs from
   * @param updatedPropertyKeys The list of properties to update in existing songs
   * @param overwriteProperties The list of properties to overwrite in existing songs
   */
  constructor(
    jsonFileName: `${string}.json`,
    updatedPropertyKeys: readonly KeyOfSong[],
    overwriteProperties: readonly KeyOfSong[] = [],
  ) {
    this.#jsonFileName = jsonFileName;
    this.#updatedPropertyKeys = updatedPropertyKeys;
    this.#overwriteProperties = overwriteProperties?.length
      ? overwriteProperties
      : updatedPropertyKeys;
  }

  async fetchSongs(): Promise<Song[]> {
    const filePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      `../../src/songs/${this.#jsonFileName}`,
    );

    const fileContent = await readFile(filePath, "utf-8");
    const gameData: GameData = JSON.parse(fileContent);
    return gameData.songs || [];
  }

  songEquals(existingSong: Song, fetchedSong: Song): boolean {
    return existingSong.saHash && fetchedSong.saHash
      ? existingSong.saHash === fetchedSong.saHash
      : existingSong.name === fetchedSong.name &&
          existingSong.artist === fetchedSong.artist;
  }

  merge(existingSong: Song, fetchedSong: Song): boolean {
    let updated = false;

    for (const key of this.#updatedPropertyKeys) {
      if (isChartKey(key)) {
        const chartKey = key.slice(7) as keyof Chart;
        for (const fetchedChart of fetchedSong.charts) {
          const existingChart = existingSong.charts.find(
            (c) =>
              c.style === fetchedChart.style &&
              c.diffClass === fetchedChart.diffClass,
          );
          if (!existingChart) {
            existingSong.charts.push(fetchedChart);
            updated = true;
          } else if (existingChart[chartKey] !== fetchedChart[chartKey]) {
            (existingChart as unknown as Record<string, unknown>)[chartKey] =
              fetchedChart[chartKey];
            updated = true;
          }
        }
      } else if (
        existingSong[key] !== fetchedSong[key] &&
        (this.#overwriteProperties.includes(key) || !existingSong[key])
      ) {
        (existingSong as unknown as Record<string, unknown>)[key] =
          fetchedSong[key];
        updated = true;
      }
    }
    return updated;

    function isChartKey(key: string): key is `charts.${keyof Chart}` {
      return key.startsWith("charts.");
    }
  }

  async fetchLastUpdated(): Promise<number> {
    const filePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      `../../src/songs/${this.#jsonFileName}`,
    );
    const fileContent = await readFile(filePath, "utf-8");
    const gameData: GameData = JSON.parse(fileContent);

    return gameData.meta.lastUpdated;
  }
}

interface ZIVSourceMeta {
  /** URL to zenius-i-vanisher game database page for this mix */
  url: string;
  /** List of difficulties in order of appearance on the page */
  difficulties?: Pick<Chart, "style" | "diffClass">[];
  /** Map of song corrections (name, partial data to merge) */
  correctionMap?: [
    string,
    Partial<Omit<Song, "charts">> & { deleted?: boolean; lvls?: number[] },
  ][];
}
export interface DDRSourceMeta {
  /** Output filename for the scraped data */
  filename: string;
  /** Prefix to add to jacket paths */
  jacketPrefix: string;
  /** Whether to sort songs by name */
  sortSongs: boolean;
  /** Flags that are not managed by importer, to be copied as-is */
  unmanagedFlags?: string[];
  /** e-amusement GATE page for this mix */
  eagate?: {
    /**
     * Music list page URL
     * @example
     * - https://p.eagate.573.jp/game/ddr/ddrworld/music/index.html?filter=7
     * - https://p.eagate.573.jp/game/eacddr/konaddr/info/mlist.html
     */
    songList: string;
    /**
     * Jacket image base URL
     * @description if truthy, use `EAGateSongImporter`, otherwise use `GrandPrixSongImporter`
     */
    jacket?: string;
  };
  /** zenius-i-vanisher game database page for this mix */
  ziv?: ZIVSourceMeta;
  /** Whether to use 3icecream song data */
  sanbai?: boolean;
  /** Link to RemyWiki page for this mix (unused on script now) */
  remy?: string;
  /** Copy specified properties from another DDR mix JSON data */
  copyFrom?: {
    file: `${string}.json`;
    keys: KeyOfSong[];
    overwriteKeys?: KeyOfSong[];
  };
}

export const DDR_WORLD: DDRSourceMeta = {
  filename: "ddr_world.json",
  jacketPrefix: "ddr_world/",
  sortSongs: true,
  unmanagedFlags: ["copyStrikes", "shock", "euLocked"],
  eagate: {
    songList:
      "https://p.eagate.573.jp/game/ddr/ddrworld/music/index.html?filter=7",
    jacket:
      "https://p.eagate.573.jp/game/ddr/ddrworld/images/binary_jk.html?kind=1",
  },
  ziv: {
    url: "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=6561&show_notecounts=1&sort=&sort_order=asc",
    // Use song metadata only from zenius-i-vanisher, don't import charts or levels
    correctionMap: [
      // #region DDR WORLD
      ["Ødyssey", { name_translation: undefined }],
      ["Mighty Beat Monsterz", { artist_translation: undefined }], // Broken HTML
      ["Ganymede -re:born-", { artist_translation: undefined }], // Broken HTML
      ["Timepiece phase II", { name: "Timepiece phase Ⅱ" }],
      ["Liar×Girl", { artist_translation: undefined }], // Broken HTML
      // #endregion DDR WORLD
      // #region DDR A3
      ["Ambivalent Vermilia", { artist_translation: undefined }], // Broken HTML
      [
        "Be With You (Still Miss You)",
        { name: "Be With You (Still Miss you)" },
      ],
      ["DIABLOSIS::Nāga", { name_translation: undefined }],
      ["一途", { deleted: true }],
      ["Look At The Sky", { name: "Look at the Sky" }],
      ["ｍｅｍｏｒｙ／／ＤＡＴＡＭＯＳＨＥＲ", { name_translation: undefined }],
      ["ミックスナッツ", { deleted: true }],
      ["SOUVENIR", { artist: "" }],
      ["suspicions", { artist_translation: undefined }], // Broken HTML
      // #endregion DDR A3
      // #region DDR A20 PLUS
      ["サイカ", { deleted: true }],
      [
        "世界の果てに約束の凱歌を -DDR Extended Megamix-",
        { artist_translation: undefined }, // Broken HTML
      ],
      ["We Can Win The Fight", { name: "We Can Win the Fight" }],
      // #endregion DDR A20 PLUS
      // #region DDR A20
      ["Lachryma(Re:Queen'M)", { name: "Lachryma《Re:Queen’M》" }],
      ["Play Hard", { deleted: true }],
      // #endregion DDR A20
      // #region DDR A
      ["Ha・lle・lu・jah", { name: "Ha･lle･lu･jah" }],
      ["恋する☆宇宙戦争っ！！", { name: "恋する☆宇宙戦争っ!!" }],
      [
        "魔法のたまご～心菜 ELECTRO POP edition～",
        { name: "魔法のたまご ～心菜 ELECTRO POP edition～" },
      ],
      [
        "さよならトリップ～夏陽 EDM edition～",
        { name: "さよならトリップ ～夏陽 EDM edition～" },
      ],
      ["Strawberry Chu♡Chu♡", { name_translation: undefined }],
      // #endregion DDR A
      // #region DDR 2014
      ["Dreamin'", { name: "Dreamin’" }],
      [
        "恋はどう？モロ◎波動OK☆方程式!!",
        { name: "恋はどう？モロ◎波動OK☆方程式！！" },
      ],
      ["MAX. (period)", { name: "MAX.(period)" }],
      ["neko*neko", { name: "neko＊neko" }],
      ['Over The "Period"', { name: "Over The “Period”" }],
      [
        "Party Lights (Tommie Sunshine’s Brooklyn Fire Remix)",
        { name: "Party Lights (Tommie Sunshine's Brooklyn Fire Remix)" },
      ],
      ["POSSESSION (EDP Live Mix)", { name: "POSSESSION(EDP Live Mix)" }],
      [
        "PRANA+REVOLUTIONARY ADDICT (U1 DJ Mix)",
        { name: "PRANA＋REVOLUTIONARY ADDICT (U1 DJ Mix)" },
      ],
      ["突撃!ガラスのニーソ姫!", { name: "突撃！ガラスのニーソ姫！" }],
      // #endregion DDR 2014
      // #region DDR 2013
      [
        "†渚の小悪魔ラヴリィ～レイディオ†(IIDX EDIT)",
        { name: "†渚の小悪魔ラヴリィ～レイディオ†" },
      ],
      ["RËVOLUTIФN", { name: "RЁVOLUTIФN" }],
      [
        "凛として咲く花の如く～ひなビタ♪edition～",
        { name: "凛として咲く花の如く ～ひなビタ♪ edition～" },
      ],
      ["Tell Me What To Do", { name: "Tell me what to do" }],
      [
        "ずっとみつめていて(Ryu☆Remix)",
        { name: "ずっとみつめていて (Ryu☆Remix)" },
      ],
      // #endregion DDR 2013
      // #region DDR X3 VS 2ndMIX
      ["ビューティフルレシート", { name: "ビューティフル レシート" }],
      ["London EVOLVED Ver.A", { name: "London EVOLVED ver.A" }],
      ["London EVOLVED Ver.B", { name: "London EVOLVED ver.B" }],
      ["London EVOLVED Ver.C", { name: "London EVOLVED ver.C" }],
      // #endregion DDR X3 VS 2ndMIX
      // #region DDR X2
      ["Leaving...", { name: "Leaving…" }],
      ["Poseidon (kors k mix)", { name: "Poseidon(kors k mix)" }],
      ["roppongi EVOLVED ver. A", { name: "roppongi EVOLVED ver.A" }],
      ["roppongi EVOLVED ver. B", { name: "roppongi EVOLVED ver.B" }],
      ["roppongi EVOLVED ver. C", { name: "roppongi EVOLVED ver.C" }],
      ["roppongi EVOLVED ver. D", { name: "roppongi EVOLVED ver.D" }],
      ["smooooch・∀・", { name: "smooooch･∀･" }],
      ["You are a star", { name: "You are a Star" }],
      // #endregion DDR X2
      // #region DDR X
      ["AFRONOVA (X-Special)", { name: "AFRONOVA(X-Special)" }],
      ["CANDY☆ (X-Special)", { name: "CANDY☆(X-Special)" }],
      [
        "Dance Dance Revolution (X-Special)",
        { name: "Dance Dance Revolution(X-Special)" },
      ],
      ["Healing Vision (X-Special)", { name: "Healing Vision(X-Special)" }],
      ["革命 (X-Special)", { name: "革命(X-Special)" }],
      ["MAX 300 (X-Special)", { name: "MAX 300(X-Special)" }],
      ["MAXX UNLIMITED (X-Special)", { name: "MAXX UNLIMITED(X-Special)" }],
      ["PARANOiA ETERNAL (X-Special)", { name: "PARANOiA ETERNAL(X-Special)" }],
      [
        "PARANOiA EVOLUTION (X-Special)",
        { name: "PARANOIA EVOLUTION(X-Special)" },
      ],
      [
        "PARANOiA MAX~DIRTY MIX~ (X-Special)",
        { name: "PARANOiA MAX～DIRTY MIX～(X-Special)" },
      ],
      ["PARANOiA Rebirth (X-Special)", { name: "PARANOiA Rebirth(X-Special)" }],
      [
        "SABER WING (AKIRA ISHIHARA Headshot mix)",
        { name: "SABER WING (Akira Ishihara Headshot mix)" },
      ],
      ["S･A･G･A", { name: "S・A・G・A" }],
      [
        "SP-TRIP MACHINE~JUNGLE MIX~ (X-Special)",
        { name: "SP-TRIP MACHINE～JUNGLE MIX～(X-Special)" },
      ],
      [
        "The legend of MAX (X-Special)",
        { name: "The legend of MAX(X-Special)" },
      ],
      ["Ticket To Bombay", { name: "Ticket to Bombay" }],
      [
        "TRIP MACHINE CLIMAX (X-Special)",
        { name: "TRIP MACHINE CLIMAX(X-Special)" },
      ],
      // #endregion DDR X
      // #region DDR SuperNOVA2
      ['AM-3P("CHAOS" Special)', { name: 'AM-3P ("CHAOS" Special)' }],
      ['B4U("VOLTAGE" Special)', { name: 'B4U ("VOLTAGE" Special)' }],
      [
        "Blind Justice ～Torn souls, Hurt Faiths～",
        { name_translation: undefined },
      ],
      [
        'BRILLIANT 2U("STREAM" Special)',
        { name: 'BRILLIANT 2U ("STREAM" Special)' },
      ],
      ['D2R("FREEZE" Special)', { name: 'D2R ("FREEZE" Special)' }],
      [
        'DEAD END("GROOVE RADAR" Special)',
        { name: 'DEAD END ("GROOVE RADAR" Special)' },
      ],
      [
        'DYNAMITE RAVE("AIR" Special)',
        { name: 'DYNAMITE RAVE ("AIR" Special)' },
      ],
      [
        "Feelings Won't Fade (Extend Trance Mix)",
        { name: "Feelings Won't Fade(Extend Trance Mix)" },
      ],
      ["Flow(Jammin' Ragga Mix)", { name: "Flow (Jammin' Ragga Mix)" }],
      [
        "L'amour et la liberté (Darwin & DJ Silver remix)",
        { name: "L'amour et la liberté(Darwin & DJ Silver remix)" },
      ],
      ["PARANOiA ～HADES～", { name_translation: undefined }],
      [
        "Raspberry♥Heart(English version)",
        { name: "Raspberry♡Heart(English version)" },
      ],
      [
        "STARS★★★ (Re-tuned by HΛL) -DDR EDITION-",
        { name: "STARS☆☆☆（Re-tuned by HΛL） - DDR EDITION -" },
      ],
      // #endregion DDR SuperNOVA2
      // #region DDR SuperNOVA
      ["BAD ROUTINE", { name: "Bad Routine" }],
      [
        "Fascination ~eternal love mix~",
        { name: "Fascination ～eternal love mix～" },
      ],
      ["Jam&Marmalade", { name: "Jam & Marmalade" }],
      ["MARIA (I believe... )", { name: "MARIA(I believe...)" }],
      ["Midnight Special", { name: "MIDNIGHT SPECIAL" }],
      // #endregion DDR SuperNOVA
      // #region DDR EXTREME
      ["AM-3P (303 BASS MIX)", { name: "AM-3P -303 BASS MIX-" }],
      ["蒼い衝動 (for EXTREME)", { name: "蒼い衝動 ～for EXTREME～" }],
      ["Colors (for EXTREME)", { name: "Colors ～for EXTREME～" }],
      ["CUTIE CHASER (MORNING MIX)", { name: "CUTIE CHASER(MORNING MIX)" }],
      ["DROP THE BOMB (SySF. Mix)", { name: "DROP THE BOMB(SyS.F. Mix)" }],
      ["Frozen Ray (for EXTREME)", { name: "Frozen Ray ～for EXTREME～" }],
      [
        "Heaven is a '57 metallic gray (gimmix)",
        { name: "Heaven is a '57 metallic gray ～gimmix～" },
      ],
      ["JANEJANA", { name: "jane jana" }],
      ["KISS ME ALL NIGHT LONG", { name: "Kiss me all night long" }],
      [
        "L'amour et la liberté (DDR Ver.)",
        { name: "L'amour et la liberté(DDR Ver.)" },
      ],
      [
        "Miracle Moon -L.E.D. LIGHT STYLE MIX-",
        { name: "Miracle Moon ～L.E.D.LIGHT STYLE MIX～" },
      ],
      ["TRIP MACHINE Survivor", { name: "TRIP MACHINE survivor" }],
      ["Twin Bee(Generation X)", { name: "Twin Bee -Generation X-" }],
      ["V (for EXTREME)", { name: "V ～for EXTREME～" }],
      // #endregion DDR EXTREME
      // #region DDRMAX2
      [
        "AFRONOVA (FROM NONSTOP MEGAMIX)",
        { name: "AFRONOVA(FROM NONSTOP MEGAMIX)" },
      ],
      ["AM-3P (AM EAST mix)", { name: "AM-3P(AM EAST mix)" }],
      ["B4U (B4 ZA BEAT MIX)", { name: "B4U(B4 ZA BEAT MIX)" }],
      ["BRE∀K DOWN!", { name: "BRE∀K DOWN！" }],
      ["BRILLIANT 2U (K.O.G. G3 MIX)", { name: "BRILLIANT 2U(K.O.G G3 MIX)" }],
      [
        "BURNIN' THE FLOOR (BLUE FIRE mix)",
        { name: "BURNIN' THE FLOOR(BLUE FIRE mix)" },
      ],
      [
        "Burning Heat! (3 Option Mix)",
        { name: "BURNING HEAT! (3 Option MIX)" },
      ],
      [
        "CELEBRATE NITE (EURO TRANCE STYLE)",
        { name: "CELEBRATE NITE(EURO TRANCE STYLE)" },
      ],
      [
        "DROP OUT (FROM NONSTOP MEGAMIX)",
        { name: "DROP OUT(FROM NONSTOP MEGAMIX)" },
      ],
      ["HIGHER (next morning mix)", { name: "HIGHER(next morning mix)" }],
      [
        "MY SUMMER LOVE (TOMMY'S SMILE MIX)",
        { name: "MY SUMMER LOVE(TOMMY'S SMILE MIX)" },
      ],
      [
        "SEXY PLANET (FROM NONSTOP MEGAMIX)",
        { name: "SEXY PLANET(FROM NONSTOP MEGAMIX)" },
      ],
      ["STILL IN MY HEART (MOMO MIX)", { name: "STILL IN MY HEART(MOMO MIX)" }],
      [
        "SUPER STAR (FROM NONSTOP MEGAMIX)",
        { name: "SUPER STAR(FROM NONSTOP MEGAMIX)" },
      ],
      ["Sweet Sweet♥Magic", { name: "Sweet Sweet ♥ Magic" }],
      [
        "WILD RUSH (FROM NONSTOP MEGAMIX)",
        { name: "WILD RUSH(FROM NONSTOP MEGAMIX)" },
      ],
      // #endregion DDRMAX2
      // #region DDRMAX
      [
        "Healing Vision (Angelic mix)",
        { name: "Healing Vision ～Angelic mix～" },
      ],
      [
        "Let the beat hit em! (CLASSIC R&B STYLE)",
        { name: "Let the beat hit em!(CLASSIC R&B STYLE)" },
      ],
      ["ORION.78 (civilization mix)", { name: "ORION.78～civilization mix～" }],
      // #endregion DDRMAX
      // #region DDR 5thMIX
      [
        "CAN'T STOP FALLIN' IN LOVE (SPEED MIX)",
        { name: "CAN'T STOP FALLIN' IN LOVE ～SPEED MIX～" },
      ],
      [
        "Electro Tuned(the SubS mix)",
        { name: "Electro Tuned ( the SubS Mix )" },
      ],
      // #endregion DDR 5thMIX
      // #region DDR 4thMIX
      ["CAN'T STOP FALLIN'IN LOVE", { name: "CAN'T STOP FALLIN' IN LOVE" }],
      ["Don't Stop! (AMD 2nd MIX)", { name: "Don't Stop!～AMD 2nd MIX～" }],
      [
        "LOVE AGAIN TONIGHT～for Melissa mix～",
        {
          name: "LOVE AGAIN TONIGHT～For Melissa MIX～",
          name_translation: undefined,
        },
      ],
      ["ORION.78 (AMeuro-MIX)", { name: "ORION.78(AMeuro-MIX)" }],
      ["PARANOiA EVOLUTION", { name: "PARANOIA EVOLUTION" }],
      // #endregion DDR 4thMIX
      // #region DDR 3rdMIX
      [
        "GRADIUSIC CYBER (AMD G5 MIX)",
        { name: "GRADIUSIC CYBER ～AMD G5 MIX～" },
      ],
      ["TRIP MACHINE (luv mix)", { name: "TRIP MACHINE～luv mix～" }],
      // #endregion DDR 3rdMIX
      // #region DDR 2ndMIX
      ["PARANOiA KCET (clean mix)", { name: "PARANOiA KCET ～clean mix～" }],
      [
        "PARANOIA MAX～DIRTY MIX～",
        { name: "PARANOiA MAX～DIRTY MIX～", name_translation: undefined },
      ],
      // #endregion DDR 2ndMIX
    ],
  },
  sanbai: true,
  remy: "https://remywiki.com/AC_DDR_WORLD",
};

export const DDR_A3: DDRSourceMeta = {
  filename: "a3.json",
  jacketPrefix: "ddr_a3/",
  sortSongs: true,
  unmanagedFlags: ["shock", "eAMUSEMENT", "eventMode"],
  eagate: {
    songList: "https://p.eagate.573.jp/game/ddr/ddra3/p/music/index.html",
    jacket:
      "https://p.eagate.573.jp/game/ddr/ddra3/p/images/binary_jk.html?kind=1",
  },
  ziv: {
    url: "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=5518&show_notecounts=1&sort=&sort_order=asc",
    correctionMap: DDR_WORLD.ziv?.correctionMap,
  },
  remy: "https://remywiki.com/AC_DDR_A3",
  copyFrom: {
    file: "ddr_world.json",
    keys: [
      "name_translation",
      "artist_translation",
      "search_hint",
      "genre",
      "jacket",
      "saIndex",
      "remyLink",
    ],
  },
};

export const DDR_A20_PLUS: DDRSourceMeta = {
  filename: "a20plus.json",
  jacketPrefix: "ddr_a20plus/",
  sortSongs: true,
  unmanagedFlags: [
    "shock",
    "eventMode",
    "usLocked",
    "removedOnA20plus",
    "euLocked",
  ],
  eagate: {
    songList: "https://p.eagate.573.jp/game/ddr/ddra20/p/music/index.html",
    jacket:
      "https://p.eagate.573.jp/game/ddr/ddra20/p/images/binary_jk.html?kind=1",
  },
  ziv: {
    url: "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=5156&show_notecounts=1&sort=&sort_order=asc",
    correctionMap: DDR_WORLD.ziv?.correctionMap,
  },
  remy: "https://remywiki.com/AC_DDR_A20_PLUS",
  copyFrom: DDR_A3.copyFrom,
};

export const DDR_X3: DDRSourceMeta = {
  filename: "ddr_x3.json",
  jacketPrefix: "ddr_x3/",
  sortSongs: true,
  ziv: {
    url: "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=347&show_notecounts=1&sort=&sort_order=asc",
    correctionMap: DDR_WORLD.ziv?.correctionMap,
  },
  remy: "https://remywiki.com/AC_DDR_X3",
  copyFrom: {
    file: "ddr_world.json",
    // 2ndMIX cross over song's jackets are different from current version, so don't copy jackets
    keys: ["search_hint", "genre", "remyLink"],
  },
};

export const DDR_X: DDRSourceMeta = {
  filename: "ddr_x.json",
  jacketPrefix: "banner/ddr_x/",
  sortSongs: true,
  ziv: {
    url: "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=148&show_notecounts=1&sort=&sort_order=asc",
  },
  remy: "https://remywiki.com/AC_DDR_X",
  copyFrom: {
    file: "ddr_world.json",
    // DDR X or earlier uses banners instead of jackets
    keys: ["search_hint", "genre", "remyLink"],
  },
};

export const DDR_SN: DDRSourceMeta = {
  filename: "ddr_sn.json",
  jacketPrefix: "banner/ddr_sn/",
  sortSongs: true,
  ziv: {
    url: "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=238&show_notecounts=1&sort=&sort_order=asc",
  },
  remy: "https://remywiki.com/AC_DDR_SuperNOVA",
  copyFrom: DDR_X.copyFrom,
};

export const DDR_EXTREME: DDRSourceMeta = {
  filename: "extreme.json",
  jacketPrefix: "banner/ddr_ext/",
  sortSongs: false,
  ziv: {
    url: "https://zenius-i-vanisher.com/v5.2/gamedb.php?gameid=81&show_notecounts=1&sort=&sort_order=asc",
  },
  remy: "https://remywiki.com/AC_DDR_EXTREME",
  copyFrom: DDR_X.copyFrom,
};

export const DDR_GRAND_PRIX: DDRSourceMeta = {
  filename: "ddr_grand_prix.json",
  jacketPrefix: "ddr_grand_prix/",
  sortSongs: true,
  eagate: {
    songList: "https://p.eagate.573.jp/game/eacddr/konaddr/info/mlist.html",
  },
  copyFrom: {
    file: "ddr_world.json",
    keys: [
      "saHash",
      "bpm",
      "folder",
      "name_translation",
      "artist_translation",
      "search_hint",
      "genre",
      "jacket",
      "remyLink",
      "charts.lvl",
      "charts.sanbaiTier",
      "charts.step",
      "charts.freeze",
      "charts.shock",
    ],
    // excepts `bpm` and `folder`
    // `bpm`: DDR GRAND PRIX is displayed BPM, but DDR WORLD is actual BPM
    // `folder`: Some songs (ex. licensed songs) are moved to DDR GRAND PRIX folder
    overwriteKeys: [
      "saHash",
      "name_translation",
      "artist_translation",
      "search_hint",
      "genre",
      "jacket",
      "remyLink",
      "charts.lvl",
      "charts.sanbaiTier",
      "charts.step",
      "charts.freeze",
      "charts.shock",
    ],
  },
};

import type { Chart, GameData, Song } from "../../src/models/SongData.ts";
import { getDom, downloadJacket } from "../utils.mts";
import type { DDRSongImporter, DDRSourceMeta } from "./ddr-sources.mts";

type ZivSongData = Pick<
  Song,
  | "name"
  | "name_translation"
  | "artist"
  | "artist_translation"
  | "bpm"
  | "folder"
  | "charts"
  | "genre"
> & { getJacketUrl: () => Promise<string | undefined> };

/** Song importer from zenius-i-vanisher */
export class ZivSongImporter implements DDRSongImporter<ZivSongData> {
  /** URL to zenius-i-vanisher game database page for this mix */
  readonly #url: string;
  /** List of difficulties in order of appearance on the page */
  readonly #difficulties: Pick<Chart, "style" | "diffClass">[];
  /** List of folder titles, if the mix has folders */
  readonly #titleList: Exclude<GameData["meta"]["folders"], undefined>;
  /** Map of song corrections (name, partial data to merge) */
  readonly #correctionMap: Map<
    string,
    Partial<Omit<Song, "charts">> & { lvls?: number[] }
  >;

  /**
   * @param url URL to zenius-i-vanisher game database page for this mix
   * @param difficulties List of difficulties in order of appearance on the page
   * @param titleList List of folder titles, if the mix has folders
   * @param correctionMap Map of song corrections (name, partial data to merge)
   */
  constructor(
    url: string,
    difficulties: Pick<Chart, "style" | "diffClass">[] = [
      { style: "single", diffClass: "beginner" },
      { style: "single", diffClass: "basic" },
      { style: "single", diffClass: "difficult" },
      { style: "single", diffClass: "expert" },
      { style: "single", diffClass: "challenge" },
      { style: "double", diffClass: "basic" },
      { style: "double", diffClass: "difficult" },
      { style: "double", diffClass: "expert" },
      { style: "double", diffClass: "challenge" },
    ],
    titleList: GameData["meta"]["folders"] = [],
    correctionMap: Required<DDRSourceMeta>["ziv"]["correctionMap"] = [],
  ) {
    this.#url = url;
    this.#difficulties = difficulties;
    this.#titleList = titleList;
    this.#correctionMap = new Map(correctionMap);
  }

  /**
   * Fetch songs from ZiV and merge with existing data
   */
  async fetchSongs(): Promise<ZivSongData[]> {
    console.log(`Starting to fetch song data from zenius-i-vanisher.com`);

    const dom = await getDom(this.#url);
    if (!dom) return [];

    const songLinks: NodeListOf<HTMLAnchorElement> =
      dom.window.document.querySelectorAll('a[href^="songdb.php"]');
    if (!this.#titleList?.length)
      return [...songLinks].map((link) => this.createSongData(link));

    /** n Songs */
    const spans: NodeListOf<HTMLSpanElement> =
      dom.window.document.querySelectorAll(
        `th[colspan="${this.#difficulties.length + 2}"] span`,
      );
    const folders = [...spans].map((span, index) => {
      const name = this.#titleList[index];
      if (!name) {
        throw new Error(`missing titleList entry at index ${index}`);
      }
      return {
        name: name,
        count: +(span.textContent.match(/^[0-9]*/)?.[0] ?? 0),
      };
    });

    const songs = [];
    let totalCount = 0;
    for (const folder of folders) {
      for (let i = 0; i < folder.count; i++) {
        songs.push(this.createSongData(songLinks[totalCount], folder.name));
        totalCount++;
      }
    }
    return songs;
  }

  /**
   * Create song data from a song link element in table cell
   * @param songLink Anchor element linking to the song details page
   * @param folder Folder name, if applicable
   */
  createSongData(
    songLink: HTMLAnchorElement,
    folder: string | undefined = undefined,
  ): ZivSongData {
    const songRow = songLink.parentElement!.parentElement!;
    const firstColumn = songRow.getElementsByTagName("td")[0];
    const artistNode = firstColumn.lastChild?.textContent?.trim()
      ? firstColumn.lastChild
      : firstColumn.lastElementChild!;
    const genreNode = firstColumn.querySelector("span.rightfloat");

    const songName = songLink.text.trim();
    const actual = this.#correctionMap.get(songName);

    // Generate charts
    const charts = [];
    const chartNodes = [...songRow.getElementsByTagName("td")].slice(2);
    if (chartNodes.length !== this.#difficulties.length) {
      throw new Error(
        `unexpected number of chart columns: ${chartNodes.length} (expected ${this.#difficulties.length}) for song ${songLink.textContent.trim()}`,
      );
    }
    for (const [i, current] of chartNodes.entries()) {
      if (!current.firstChild || current.firstChild.textContent === "-")
        continue;
      const [step, freeze, shock] = current
        .lastElementChild!.textContent.split(" / ")
        .map(Number);
      const lv = Number(current.firstChild.textContent);
      const actualLv = actual?.lvls?.[i];
      if (actualLv) {
        if (actualLv !== lv)
          console.log(
            `Fixed ziv data "${songName}" [${this.#difficulties[i].style}/${this.#difficulties[i].diffClass}] lvl: ${current.firstChild.textContent} -> ${actualLv}`,
          );
        else
          console.warn(
            `No changes needed for lvl on ${songName}[${this.#difficulties[i].style}/${this.#difficulties[i].diffClass}]. Consider remove on correctionMap.lvls.`,
          );
      }

      const chart = {
        lvl: actualLv || lv,
        ...this.#difficulties[i],
        ...(step > 0 ? { step } : {}),
        ...(freeze > 0 ? { freeze } : {}),
        ...(shock > 0 ? { shock, flags: ["shock"] } : {}),
      };
      charts.push(chart);
    }

    const song = {
      name: songName,
      name_translation: getTranslationText(songLink),
      artist: artistNode?.textContent?.trim() ?? "",
      artist_translation: getTranslationText(artistNode),
      bpm: songRow.children[1].textContent.trim(),
      folder,
      charts,
      genre: genreNode ? genreNode.textContent.trim() : undefined,
      getJacketUrl: () => getJacketUri(songLink.href),
    };

    if (actual) {
      for (const [key, value] of Object.entries(actual)) {
        // Except lvls
        if (key === "lvls") continue;
        const typedKey = key as keyof typeof song;

        if (!Array.isArray(value) && value !== song[typedKey]) {
          // Use type assertion to safely assign the value
          (song as Record<string, unknown>)[key] = value;
        } else {
          console.warn(
            `No changes needed for ${key} on ${song.name}. Consider remove on correctionMap.`,
          );
        }
      }
    }
    return song;

    /**
     * @param {Element|Node} node
     * @returns {string|undefined}
     */
    function getTranslationText(node: Element | Node): string | undefined {
      if (!isElement(node)) {
        return undefined;
      }
      const translationNodeQuery = "span[onmouseover]";
      const translationNode = node.matches(translationNodeQuery)
        ? node
        : node.querySelector(translationNodeQuery);
      if (!translationNode) {
        return undefined;
      }
      return translationNode.attributes
        .getNamedItem("onmouseover")
        ?.value.replace(/this\.innerHTML='(.+)';/, "$1");

      /**
       * @returns {node is Element}
       * @param {Element | Node} node
       */
      function isElement(node: Element | Node): node is Element {
        return node.nodeName !== "#text";
      }
    }

    /**
     * @param {string} songUri
     * @return {Promise<string|undefined>}
     */
    async function getJacketUri(songUri: string): Promise<string | undefined> {
      const dom = await getDom(songUri);
      if (!dom) return undefined;
      const image: HTMLImageElement | null = dom.window.document.querySelector(
        "table > tbody > tr > td > img",
      );
      return image ? image.src : undefined;
    }
  }

  /**
   * Compares two song objects for equality
   * @param existingSong Existing song in the database
   * @param fetchedSong Newly fetched song from zenius-i-vanisher
   * @returns True if songs are considered equal (same name)
   */
  songEquals(existingSong: Song, fetchedSong: ZivSongData): boolean {
    return existingSong.name === fetchedSong.name;
  }

  /**
   * Merges data from an `fetchedSong` into `existingSong` object.
   * @summary This function with side effects that change `existingSong` object
   * @param existingSong Existing song object to update
   * @param fetchedSong Song data from ZIV
   * @returns True if the merge resulted in any updates
   */
  async merge(existingSong: Song, fetchedSong: ZivSongData): Promise<boolean> {
    let hasUpdates = false;

    // Update song metadata if missing
    if (!existingSong.name_translation && fetchedSong.name_translation) {
      console.log(
        `Updated "${existingSong.name}" name_translation: ${existingSong.name_translation} -> ${fetchedSong.name_translation}`,
      );
      existingSong.name_translation = fetchedSong.name_translation;
      hasUpdates = true;
    }
    if (!existingSong.artist_translation && fetchedSong.artist_translation) {
      console.log(
        `Updated "${existingSong.name}" artist_translation: ${existingSong.artist_translation} -> ${fetchedSong.artist_translation}`,
      );
      existingSong.artist_translation = fetchedSong.artist_translation;
      hasUpdates = true;
    }
    if (!existingSong.genre && fetchedSong.genre) {
      console.log(
        `Updated "${existingSong.name}" genre: ${existingSong.genre} -> ${fetchedSong.genre}`,
      );
      existingSong.genre = fetchedSong.genre;
      hasUpdates = true;
    }

    // Try to get jacket from ziv
    if (!existingSong.jacket) {
      const jacketUrl = await fetchedSong.getJacketUrl();
      if (!jacketUrl) {
        return hasUpdates;
      }
      const jacket = downloadJacket(jacketUrl, fetchedSong.name);
      if (jacket) {
        existingSong.jacket = jacket;
        console.log(`Added "${existingSong.name}" jacket: ${jacket}`);
        hasUpdates = true;
      }
    }

    return hasUpdates;
  }
}

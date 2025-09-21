// @ts-check
/** @typedef {import("../../src/models/SongData.ts").Song} Song */
/** @typedef {import("../../src/models/SongData.ts").Chart} Chart */
/** @typedef {import("../../src/models/SongData.ts").GameData} GameData */

import { getDom, downloadJacket } from "../utils.mjs";

/** Song importer from zenius-i-vanisher */
export class ZivSongImporter {
  /** URL to zenius-i-vanisher game database page for this mix */
  #url;
  /** List of difficulties in order of appearance on the page */
  #difficulties;
  /** List of folder titles, if the mix has folders */
  #titleList;
  /** Map of song corrections (name, partial data to merge) */
  #correctionMap;

  /**
   * @param {string} url URL to zenius-i-vanisher game database page for this mix
   * @param {Pick<Chart, 'style' | 'diffClass'>[]} [difficulties] List of difficulties in order of appearance on the page
   * @param {GameData['meta']['folders']} [titleList=[]] List of folder titles, if the mix has folders
   * @param {[string, Partial<Omit<Song, 'charts'>> & { deleted?: boolean, lvls?: number[] }][]} [correctionMap=[]] Map of song corrections (name, partial data to merge)
   */
  constructor(
    url,
    difficulties = [
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
    titleList = [],
    correctionMap = [],
  ) {
    this.#url = url;
    this.#difficulties = difficulties;
    this.#titleList = titleList;
    this.#correctionMap = new Map(correctionMap);
  }

  /**
   * Fetch songs from ZiV and merge with existing data
   * @returns {Promise<(Pick<Song, "name" | "name_translation" | "artist" | "artist_translation" | "bpm" | "folder" | "charts" | "genre"> & { deleted?: boolean, getJacketUrl: () => Promise<string> })[]>}
   */
  async fetchSongs() {
    console.log(`Starting to fetch song data from zenius-i-vanisher.com`);

    const dom = await getDom(this.#url);
    if (!dom) return [];

    /** @type {NodeListOf<HTMLAnchorElement>} */
    const songLinks = dom.window.document.querySelectorAll(
      'a[href^="songdb.php"]',
    );
    if (!this.#titleList?.length)
      return [...songLinks].map((link) => this.createSongData(link));

    /** n Songs @type {NodeListOf<HTMLSpanElement>} */
    const spans = dom.window.document.querySelectorAll(
      `th[colspan="${this.#difficulties.length + 2}"] span`,
    );
    const folders = [...spans].map((span, index) => {
      const name = this.#titleList[index];
      if (!name) {
        throw new Error(`missing titleList entry at index ${index}`);
      }
      return {
        name: name,
        count: +span.textContent.match(/^[0-9]*/)[0],
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
   *
   * @param {HTMLAnchorElement} songLink
   * @param {string=} folder
   * @returns {Awaited<ReturnType<ZivSongImporter["fetchSongs"]>  & { deleted: boolean }>[number]}
   */
  createSongData(songLink, folder) {
    const songRow = songLink.parentElement.parentElement;
    const firstColumn = songRow.getElementsByTagName("td")[0];
    const artistNode = firstColumn.lastChild.textContent.trim()
      ? firstColumn.lastChild
      : firstColumn.lastElementChild;
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
      if (current.firstChild.textContent === "-") continue;
      const [step, freeze, shock] = current.lastElementChild.textContent
        .split(" / ")
        .map(Number);
      const actualLv = actual?.lvls?.[i];
      if (actualLv) {
        if (actualLv !== +current.firstChild.textContent)
          console.log(
            `Fixed ziv data "${songName}" [${this.#difficulties[i].style}/${this.#difficulties[i].diffClass}] lvl: ${current.firstChild.textContent} -> ${actualLv}`,
          );
        else
          console.warn(
            `No changes needed for lvl on ${songName}[${this.#difficulties[i].style}/${this.#difficulties[i].diffClass}]. Consider remove on correctionMap.lvls.`,
          );
      }

      const chart = {
        lvl: actualLv || +current.firstChild.textContent,
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
      artist: artistNode.textContent.trim(),
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

        if (!Array.isArray(value) && value !== song[key]) {
          song[key] = value;
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
    function getTranslationText(node) {
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
      return translationNode.attributes["onmouseover"].value.replace(
        /this\.innerHTML='(.+)';/,
        "$1",
      );

      /**
       * @returns {node is Element}
       * @param {Element | Node} node
       */
      function isElement(node) {
        return node.nodeName !== "#text";
      }
    }

    /**
     * @param {string} songUri
     * @return {Promise<string|undefined>}
     */
    async function getJacketUri(songUri) {
      const dom = await getDom(songUri);
      if (!dom) return undefined;
      /** @type {HTMLImageElement} */
      const image = dom.window.document.querySelector(
        "table > tbody > tr > td > img",
      );
      return image ? image.src : undefined;
    }
  }

  /**
   * Compares two song objects for equality
   * @param {Song} existingSong
   * @param {Awaited<ReturnType<ZivSongImporter["fetchSongs"]>>[number]} zivSong
   * @returns {boolean} True if songs are considered equal (same name)
   */
  static songEquals(existingSong, zivSong) {
    return existingSong.name === zivSong.name;
  }

  /**
   * Merges data from an `zivSong` into `existingSong` object.
   * @summary This function with side effects that change `existingSong` object
   * @param {Song} existingSong Existing song object to update
   * @param {Awaited<ReturnType<ZivSongImporter["fetchSongs"]>>[number]} zivSong Song data from ZIV
   * @returns {Promise<boolean>} True if the merge resulted in any updates
   */
  static async merge(existingSong, zivSong) {
    let hasUpdates = false;

    // Update song metadata if missing
    if (!existingSong.name_translation && zivSong.name_translation) {
      console.log(
        `Updated "${existingSong.name}" name_translation: ${existingSong.name_translation} -> ${zivSong.name_translation}`,
      );
      existingSong.name_translation = zivSong.name_translation;
      hasUpdates = true;
    }
    if (!existingSong.artist_translation && zivSong.artist_translation) {
      console.log(
        `Updated "${existingSong.name}" artist_translation: ${existingSong.artist_translation} -> ${zivSong.artist_translation}`,
      );
      existingSong.artist_translation = zivSong.artist_translation;
      hasUpdates = true;
    }
    if (!existingSong.genre && zivSong.genre) {
      console.log(
        `Updated "${existingSong.name}" genre: ${existingSong.genre} -> ${zivSong.genre}`,
      );
      existingSong.genre = zivSong.genre;
      hasUpdates = true;
    }

    // Try to get jacket from ziv
    if (!existingSong.jacket) {
      const jacket = downloadJacket(await zivSong.getJacketUrl(), zivSong.name);
      if (jacket) {
        existingSong.jacket = jacket;
        console.log(`Added "${existingSong.name}" jacket: ${jacket}`);
        hasUpdates = true;
      }
    }

    return hasUpdates;
  }
}

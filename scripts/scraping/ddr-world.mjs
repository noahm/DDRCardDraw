// @ts-check
/** @typedef {import("../../src/models/SongData.ts").Song} Song */
/** @typedef {import("../../src/models/SongData.ts").Chart} Chart */

import { downloadJacket, getDom } from "../utils.mjs";

/**
 * Name & Artist Normalization
 * @type {Map<Song['saHash'], Partial<Pick<Song, 'name' | "artist">>>}
 */
const normalized = new Map([
  [
    "q1DPdd1ooiPi9P0b0Obqq1QqbD86Qb18",
    { name: "鏡花水月楼 (DDR EDITION)", artist: "TЁЯRA feat.宇宙戦隊NOIZ" },
  ],
  [
    "bq8DOQ9Idq9Ii9PQ1bqPIQoQPl961d1o",
    { name: "零 - ZERO -", artist: "TЁЯRA" },
  ],
  [
    "6iq1dqQ1PDQlDO0bio0l89oDDDi6b0oD",
    { name: "華爛漫 -Flowers-", artist: "TЁЯRA" },
  ],
  ["DQO6qbiP6dldo6IIqlob9i8dqiqOio6o", { name: "夢幻ノ光", artist: "TЁЯRA" }],
  ["OO0QbD9D6QQIb10Q9IDOQd8odb6ob6qP", { name: "DoLL", artist: "TЁЯRA" }],
  ["OqIlb9PQIo0Io90PIQi6q86dO8iP19Oi", { name: "ever snow", artist: "TЁЯRA" }],
  [
    "qOQQ1qdQPPQ1bbdPldPlIil99IDoPi61",
    { name: "Sacred Oath", artist: "TЁЯRA" },
  ],
  [
    "6qQb9I0QbD89IID9b9iOPdO6dbqPDolQ",
    { name: "STARS☆☆☆(2nd NAOKI's style)", artist: "TЁЯRA" },
  ],
  [
    "bq1O60D90Qbb6iPoi90Ii9olQOIO0Ib1",
    { name: "STARS☆☆☆（Re-tuned by HΛL） - DDR EDITION -", artist: "TЁЯRA" },
  ],
  [
    "PP9QDQ0IQQID00P61d8qdDdP09b19iiI",
    { name: "Blind Justice ～Torn souls, Hurt Faiths～" },
  ],
  [
    "i86qD6Pl61dPI0Q9db1P8bl1ii99q1lD",
    { name: "BURNING HEAT! (3 Option MIX)" },
  ],
  [
    "DDPPI6IIi0i9looibDbiODoOPOl6ID8i",
    { name: "Feidie", artist: "A-One feat. Napoleon" },
  ],
  [
    "ob0P66Q8dqbI81qi6OQDPP6086iPoO1P",
    { name: "GRADIUS REMIX (↑↑↓↓←→←→BA Ver.)" },
  ],
  [
    "81QD89Q6Ob911oOoobO0D98IQ1D1q60d",
    { name: "RED ZONE", artist: "Tatsh&NAOKI" },
  ],
  [
    "1Dl19idl0i0qiqidbDIIbQddiP6o11PP",
    { name: "MAX 360", artist: 'BEMANI Sound Team "[𝑥]"' },
  ],
]);

export class EAGateSongImporter {
  #songListUrl;
  #jacketUrl;

  /**
   * @param {string} songListUrl
   * @param {string} jacketUrl
   */
  constructor(songListUrl, jacketUrl) {
    this.#songListUrl = songListUrl;
    this.#jacketUrl = jacketUrl;
  }

  /**
   * Fetches song data from KONAMI e-amusement GATE
   * @returns {Promise<(Required<Pick<Song, "name" | "artist" | "saHash" | "charts">> & { getJacketUrl: () => string })[]>}
   */
  async fetchSongs() {
    console.log(`Starting to fetch song data from KONAMI e-amusement GATE`);

    const jacketUrl = this.#jacketUrl;
    const songsPerPage = 50;
    const allSongs = [];
    let currentPage = 0;
    let emptyPageCount = 0;
    const maxEmptyPages = 3; // Stop after 3 consecutive empty pages

    while (emptyPageCount < maxEmptyPages) {
      const offset = currentPage;

      // Construct URL with offset parameter
      const url = new URL(this.#songListUrl);
      url.searchParams.set("offset", offset.toString());
      const pageUrl = url.toString();

      console.log(`Fetching page ${currentPage + 1}... (offset=${offset})`);

      try {
        const pageSongs = await scrape(pageUrl);

        if (pageSongs.length === 0) {
          emptyPageCount++;
          console.log(
            `Page ${currentPage + 1} is empty (consecutive empty pages: ${emptyPageCount}/${maxEmptyPages})`,
          );
        } else {
          emptyPageCount = 0; // Reset counter when songs are found
          allSongs.push(...pageSongs);
          console.log(
            `Page ${currentPage + 1}: ${pageSongs.length} songs fetched (total: ${allSongs.length} songs)`,
          );

          // If songs fetched is less than songsPerPage, likely the last page
          if (pageSongs.length < songsPerPage) {
            console.log(
              `Songs fetched (${pageSongs.length}) is less than expected (${songsPerPage}), assuming last page`,
            );
            break;
          }
        }

        // Wait briefly between pages (reduce server load)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(
          `Error occurred while fetching page ${currentPage + 1}:`,
          error,
        );
        emptyPageCount++;
      }

      currentPage++;
    }

    // Remove duplicate songs (determined by saHash)
    const uniqueSongs = [];
    const seenHashes = new Set();

    for (const song of allSongs) {
      if (song.saHash && !seenHashes.has(song.saHash)) {
        seenHashes.add(song.saHash);
        uniqueSongs.push(song);
      } else if (!song.saHash) {
        // If no hash, determine by song name and artist
        const songKey = `${song.name}::${song.artist}`;
        if (!seenHashes.has(songKey)) {
          seenHashes.add(songKey);
          uniqueSongs.push(song);
        }
      }
    }

    console.log(
      `Fetch completed: ${uniqueSongs.length} songs (before deduplication: ${allSongs.length} songs)`,
    );
    console.log(`Pages processed: ${currentPage}`);

    return uniqueSongs;

    /**
     * @summary Scrapes song data from KONAMI e-amusement GATE website
     * @param {string} pageUrl DDR song list URL
     */
    async function scrape(pageUrl) {
      const dom = await getDom(pageUrl);
      if (!dom) return [];

      const songs = [];

      // Scrape based on DDR site table structure
      const table = dom.window.document.querySelector("table");
      if (!table) {
        console.warn("Song table not found");
        return [];
      }

      const rows = table.querySelectorAll("tr");
      if (rows.length < 3) {
        console.warn("Insufficient number of rows");
        return [];
      }

      // Rows from the 3rd onward contain song data (1st row is header, 2nd row is subheader)
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll("td");

        if (cells.length < 4) continue;

        try {
          // Get hash value (extracted from jacket image filename)
          /** @type {HTMLImageElement | null} */
          const jacketImg = cells[0].querySelector("img");
          let saHash = "";

          if (jacketImg?.src) {
            // URL example: /game/ddr/ddrworld/images/binary_jk.html?img=6iqOPoP6lQi8ilD10o8ol11DQbqooOqP&kind=2
            const imgMatch = jacketImg.src.match(/img=([a-zA-Z0-9]+)/);
            saHash = imgMatch ? imgMatch[1] : "";
          }

          // Get song name (2nd cell)
          const name = cells[1]?.textContent?.trim() || "";

          // Get artist name (3rd cell) - can be empty for cover songs
          const artist = cells[2]?.textContent?.trim() || "";

          if (!name) continue; // Only require name, artist can be empty for cover songs

          // Get chart difficulties
          const charts = [];

          /**
           * Chart difficulties
           * (cells 4-8: Single BE, BA, DI, EX, CH)
           * (cells 9-12: Double BA, DI, EX, CH)
           * @type {Pick<Chart, 'style' | 'diffClass'>[]}
           */
          const difficulties = [
            { style: "single", diffClass: "beginner" },
            { style: "single", diffClass: "basic" },
            { style: "single", diffClass: "difficult" },
            { style: "single", diffClass: "expert" },
            { style: "single", diffClass: "challenge" },
            { style: "double", diffClass: "basic" },
            { style: "double", diffClass: "difficult" },
            { style: "double", diffClass: "expert" },
            { style: "double", diffClass: "challenge" },
          ];
          for (let j = 0; j < difficulties.length; j++) {
            const cellIndex = 3 + j; // Starting from 4th cell
            if (cellIndex < cells.length) {
              const level = cells[cellIndex]?.textContent?.trim();
              if (level && !isNaN(parseInt(level)) && parseInt(level) > 0) {
                charts.push({ ...difficulties[j], lvl: parseInt(level) });
              }
            }
          }

          songs.push({
            name,
            artist,
            ...normalized.get(saHash), // Name & Artist Normalization
            saHash,
            charts,
            getJacketUrl: () => `${jacketUrl}&img=${saHash}`,
          });
        } catch (error) {
          console.error(`Failed to parse song data (row ${i + 1}):`, error);
        }
      }

      return songs;
    }
  }

  /**
   * Compares two song objects for equality
   * @param {Song} existingSong
   * @param {Awaited<ReturnType<EAGateSongImporter["fetchSongs"]>>[number]} eagateSong
   * @returns {boolean} True if songs are considered equal (same saHash)
   */
  static songEquals(existingSong, eagateSong) {
    return existingSong.saHash === eagateSong.saHash;
  }

  /**
   * Merges data from an `eagateSong` into `existingSong` object.
   * @summary This function with side effects that change `existingSong` object
   * @param {Song} existingSong Existing song object to update
   * @param {Awaited<ReturnType<EAGateSongImporter["fetchSongs"]>>[number]} eagateSong Song data from e-amusement GATE
   * @param {string[]} unmanagedFlags Flags to preserve
   * @returns {boolean} True if the merge resulted in any updates
   */
  static merge(existingSong, eagateSong, unmanagedFlags = []) {
    let hasUpdates = false;

    // Update name if different (prefer e-amusement GATE notation)
    if (existingSong.name !== eagateSong.name) {
      console.log(
        `Updated song name: "${existingSong.name}" -> "${eagateSong.name}"`,
      );
      existingSong.name = eagateSong.name;
      hasUpdates = true;
    }

    // Update artist (prefer e-amusement GATE notation)
    if (existingSong.artist !== eagateSong.artist) {
      console.log(
        `Updated "${eagateSong.name}" artist: "${existingSong.artist}" -> "${eagateSong.artist}"`,
      );
      existingSong.artist = eagateSong.artist;
      hasUpdates = true;
    }

    // Update charts - merge with existing charts, prefer e-amusement GATE data for lvl
    for (const eagateChart of eagateSong.charts) {
      const existingChart = existingSong.charts.find(
        (chart) =>
          chart.style === eagateChart.style &&
          chart.diffClass === eagateChart.diffClass,
      );

      if (!existingChart) {
        console.log(
          `Added "${eagateSong.name}": [${eagateChart.style}/${eagateChart.diffClass}] (Lv.${eagateChart.lvl})`,
        );
        existingSong.charts.push({ ...eagateChart });
        hasUpdates = true;
        continue;
      }

      // Update level if different
      if (existingChart.lvl !== eagateChart.lvl) {
        console.log(
          `Updated "${eagateSong.name}" [${eagateChart.style}/${eagateChart.diffClass}] level: ${existingChart.lvl} -> ${eagateChart.lvl}`,
        );
        existingChart.lvl = eagateChart.lvl;
        hasUpdates = true;
      }

      // Remove unlock-related flags (e-amusement GATE only lists playable songs by default)
      if (existingChart.flags) {
        const flagsToRemove = existingChart.flags.filter(
          (f) => !unmanagedFlags.includes(f),
        );
        if (flagsToRemove.length > 0) {
          existingChart.flags = existingChart.flags.filter((f) =>
            unmanagedFlags.includes(f),
          );
          if (existingChart.flags.length === 0) {
            delete existingChart.flags;
          }
          console.log(
            `Removed "${eagateSong.name}" [${eagateChart.style}/${eagateChart.diffClass}] flags: ${flagsToRemove}`,
          );
          hasUpdates = true;
        }
      }
    }

    // Try to get jacket from e-amusement GATE
    if (!existingSong.jacket && eagateSong.saHash) {
      const jacket = downloadJacket(
        eagateSong.getJacketUrl(),
        existingSong.name,
      );
      if (jacket) {
        console.log(`Added "${existingSong.name}" jacket: ${jacket}`);
        existingSong.jacket = jacket;
        hasUpdates = true;
      }
    }

    // Remove unlock-related flags (e-amusement GATE only lists playable songs by default)
    if (existingSong.flags) {
      const flagsToRemove = existingSong.flags.filter(
        (f) => !unmanagedFlags.includes(f),
      );
      if (flagsToRemove.length > 0) {
        existingSong.flags = existingSong.flags.filter((f) =>
          unmanagedFlags.includes(f),
        );
        if (existingSong.flags.length === 0) {
          delete existingSong.flags;
        }
        console.log(
          `Removed unlock flags for ${existingSong.name}: ${flagsToRemove.join(", ")}`,
        );
        hasUpdates = true;
      }
    }
    return hasUpdates;
  }
}

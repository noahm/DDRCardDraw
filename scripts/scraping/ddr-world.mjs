// @ts-check
/** @typedef {import("jsdom").JSDOM} JSDOM */
/** @typedef {import("../../src/models/SongData.ts").Song} SongData */
/** @typedef {import("../../src/models/SongData.ts").Chart} ChartData */

import { getDom } from "../utils.mjs";

/**
 * Downloads jacket image from DDR World official site
 * @param {string} saHash The saHash value for the song
 * @param {string} songName The song name for filename generation
 * @returns {Promise<string|null>} Returns the saved filename or null if failed
 */
export async function getJacketFromDDRWorld(saHash, songName) {
  if (!saHash) return null;

  try {
    const jacketUrl = `https://p.eagate.573.jp/game/ddr/ddrworld/images/binary_jk.html?img=${saHash}&kind=1`;

    // Use the same jacket downloading logic as other scrapers
    const { downloadJacket } = await import("../utils.mjs");
    const filename = await downloadJacket(jacketUrl, songName);

    return filename;
  } catch (error) {
    console.warn(
      `Failed to download jacket from DDR World for ${songName}:`,
      error,
    );
    return null;
  }
}

/**
 * Name conversion mapping
 * Maps DDR World display names to standardized names
 * Can be used for both song names and artist names
 */
const NAME_CONVERSIONS = {
  ＴЁЯＲＡ: "TЁЯRA",
  "Blind Justice ～Torn souls, Hurt Faiths ～":
    "Blind Justice ～Torn souls, Hurt Faiths～",
  "BURNING HEAT！（3 Option MIX）": "BURNING HEAT! (3 Option MIX)",
  "A-One  feat.Napoleon": "A-One feat. Napoleon",
  "GRADIUS REMIX（↑↑↓↓←→←→BA Ver.)": "GRADIUS REMIX (↑↑↓↓←→←→BA Ver.)",
  "Tatsh＆NAOKI": "Tatsh&NAOKI",
  'BEMANI Sound Team "[x]"': 'BEMANI Sound Team "[𝑥]"',
};

/**
 * Normalize name using conversion mapping
 * @param {string} name Original name (song name or artist name)
 * @returns {string} Normalized name
 */
function normalizeName(name) {
  let normalized = name;

  // Apply all defined conversions
  for (const [original, replacement] of Object.entries(NAME_CONVERSIONS)) {
    // Escape special regex characters in the original string
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(
      new RegExp(escapedOriginal, "g"),
      replacement,
    );
  }

  return normalized;
}

/**
 * @typedef {Pick<ChartData, "style" | "diffClass" | "lvl">} Chart
 */

/**
 * @typedef {Pick<SongData, "name" | "artist" | "saHash" | "charts">} Song
 */

/**
 * Scrapes song data from DDR World official website
 * @param {string} pageUrl DDR World song list URL
 * @returns {Promise<Song[]>}
 */
export async function getSongsFromDDRWorld(pageUrl) {
  const dom = await getDom(pageUrl);
  if (!dom) return [];

  const songs = [];

  // Scrape based on DDR World site table structure
  const table = dom.window.document.querySelector("table");
  if (!table) {
    console.log("Song table not found");
    return [];
  }

  const rows = table.querySelectorAll("tr");
  if (rows.length < 3) {
    console.log("Insufficient number of rows");
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
      const name = normalizeName(cells[1]?.textContent?.trim() || "");

      // Get artist name (3rd cell) - can be empty for cover songs
      // Normalize artist name using conversion mapping
      const artist = normalizeName(cells[2]?.textContent?.trim() || "");

      if (!name) continue; // Only require name, artist can be empty for cover songs

      // Get chart difficulties
      const charts = [];

      // SINGLE chart difficulties (cells 4-8: BE, BA, DI, EX, CH)
      const singleDifficulties = [
        "beginner",
        "basic",
        "difficult",
        "expert",
        "challenge",
      ];
      for (let j = 0; j < 5; j++) {
        const cellIndex = 3 + j; // Starting from 4th cell
        if (cellIndex < cells.length) {
          const level = cells[cellIndex]?.textContent?.trim();
          if (level && !isNaN(parseInt(level)) && parseInt(level) > 0) {
            charts.push({
              style: "single",
              diffClass: singleDifficulties[j],
              lvl: parseInt(level),
            });
          }
        }
      }

      // DOUBLE chart difficulties (cells 9-12: BA, DI, EX, CH - no beginner)
      const doubleDifficulties = ["basic", "difficult", "expert", "challenge"];
      for (let j = 0; j < 4; j++) {
        const cellIndex = 8 + j; // Starting from 9th cell
        if (cellIndex < cells.length) {
          const level = cells[cellIndex]?.textContent?.trim();
          if (level && !isNaN(parseInt(level)) && parseInt(level) > 0) {
            charts.push({
              style: "double",
              diffClass: doubleDifficulties[j],
              lvl: parseInt(level),
            });
          }
        }
      }

      songs.push({
        name,
        artist,
        saHash,
        charts,
      });
    } catch (error) {
      console.warn(`Failed to parse song data (row ${i + 1}):`, error);
    }
  }

  return songs;
}

/**
 * Get song data from all pages of DDR World
 * @param {string} baseUrl Base URL (without offset parameter)
 * @param {number|null} maxPages Maximum number of pages (null for unlimited)
 * @param {number} songsPerPage Number of songs per page (default 50)
 * @returns {Promise<Song[]>}
 */
export async function getAllSongsFromDDRWorld(
  baseUrl,
  maxPages = null,
  songsPerPage = 50,
) {
  const maxPagesText = maxPages ? `${maxPages}` : "unlimited";
  console.log(
    `Starting to fetch song data from DDR World, up to ${maxPagesText} pages...`,
  );

  const allSongs = [];
  let currentPage = 0;
  let emptyPageCount = 0;
  const maxEmptyPages = 3; // Stop after 3 consecutive empty pages

  while (
    (maxPages === null || currentPage < maxPages) &&
    emptyPageCount < maxEmptyPages
  ) {
    const offset = currentPage;

    // Construct URL with offset parameter
    const url = new URL(baseUrl);
    url.searchParams.set("offset", offset.toString());
    const pageUrl = url.toString();

    const pageDisplayText = maxPages
      ? `${currentPage + 1}/${maxPages}`
      : `${currentPage + 1}`;
    console.log(`Fetching page ${pageDisplayText}... (offset=${offset})`);

    try {
      const pageSongs = await getSongsFromDDRWorld(pageUrl);

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
}

/**
 * Convenience function to fetch all song data from DDR World
 * @param {Object} [options] Option settings
 * @param {number} [options.filter] Filter setting (default: 7)
 * @param {number} [options.maxPages] Maximum number of pages (default: unlimited)
 * @param {number} [options.songsPerPage] Number of songs per page (default: 50)
 * @returns {Promise<Song[]>}
 */
export async function fetchAllDDRWorldSongs(options = {}) {
  const { filter = 7, maxPages = null, songsPerPage = 50 } = options;

  const baseParams = new URLSearchParams({ filter: filter.toString() });
  const baseUrl = `https://p.eagate.573.jp/game/ddr/ddrworld/music/index.html?${baseParams.toString()}`;

  return await getAllSongsFromDDRWorld(baseUrl, maxPages, songsPerPage);
}

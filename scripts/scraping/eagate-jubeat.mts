import { downloadJacket, getDom } from "../utils.mts";
import type { Chart, Song } from "../../src/models/SongData.ts";

/** Name & Artist Normalization */
const normalized: Map<
  Song["saHash"],
  Partial<Pick<Song, "name" | "artist">>
> = new Map([
  ["id35802983", { name: "TRUE♥LOVE" }],
  ["id68218329", { name: "Love ♡ km" }],
  ["id75837790", { name: "Love ♡ km [ 2 ]" }],
  ["id12348190", { name: "TWINKLE♡HEART" }],
  ["id51162734", { name: "Strawberry Chu♡Chu♡" }],
  ["id69740316", { name: "Milchstraße" }],
  [
    "id39733566",
    { name: "ヤマトなでなで♡かぐや姫", artist: "ロマンチック♡Prim姫" },
  ],
]);

type EagateSong = Pick<Song, "name" | "artist" | "saHash" | "charts"> & {
  jacketUrl: string;
};

/**
 * Importer for jubeat from e-amusement GATE
 * - https://p.eagate.573.jp/game/jubeat/beyond/music/index.html
 * - https://p.eagate.573.jp/game/jubeat/beyond/music/original.html
 */
export class SongImporter {
  #songListUrl: string;

  constructor(songListUrl: string) {
    this.#songListUrl = songListUrl;
  }

  async fetchSongs(): Promise<EagateSong[]> {
    console.log(`Starting to fetch song data from jubeat e-amusement GATE`);

    const songsPerPage = 50;
    const allSongs: EagateSong[] = [];
    let currentPage = 0;
    let emptyPageCount = 0;
    const maxEmptyPages = 3; // Stop after 3 consecutive empty pages

    while (emptyPageCount < maxEmptyPages) {
      const page = currentPage;

      // Construct URL with offset parameter (same strategy as DDR importer)
      const url = new URL(this.#songListUrl);
      url.searchParams.set("page", page.toString());

      console.log(`Fetching page ${currentPage + 1}... (page=${page})`);

      try {
        const pageSongs = await scrape(url);

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

    // Remove duplicate songs by name+artist
    const uniqueSongs: EagateSong[] = [];
    const seen = new Set<string>();
    for (const song of allSongs) {
      const key = `${song.name}::${song.artist}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSongs.push(song);
      }
    }

    console.log(
      `Fetch completed: ${uniqueSongs.length} songs (before deduplication: ${allSongs.length} songs)`,
    );
    console.log(`Pages processed: ${currentPage}`);

    return uniqueSongs;

    /**
     * Scrapes song data from jubeat e-amusement GATE website
     * @param url jubeat song list URL
     */
    async function scrape(url: URL): Promise<EagateSong[]> {
      const dom = await getDom(url.toString());
      if (!dom) return [];

      const doc = dom.window.document;
      const list = doc.querySelectorAll(
        "#music_list .list_data_box .list_data",
      );
      if (!list || list.length === 0) {
        return [];
      }

      const songs: EagateSong[] = [];
      const origin = url.origin;

      list.forEach((item) => {
        try {
          // Jacket image
          const img = item.querySelector<HTMLImageElement>("p > img");
          let jacketUrl = img?.getAttribute("src")?.trim() || "";
          if (jacketUrl && jacketUrl.startsWith("/")) {
            jacketUrl = origin + jacketUrl;
          }
          // saHash: use jacket file name without extension
          let saHash = "";
          if (jacketUrl) {
            const withoutQuery = jacketUrl.split("?")[0];
            const parts = withoutQuery.split("/");
            const filename = parts[parts.length - 1] || "";
            saHash = filename.replace(/\.[^.]+$/, ""); // e.g. id18283302
          }

          // Title and artist
          const ul = item.querySelector("ul");
          const liNodes = ul ? ul.querySelectorAll(":scope > li") : null;
          const name = liNodes?.[0]?.textContent?.trim() || "";
          const artist = liNodes?.[1]?.textContent?.trim() || "";

          if (!name) return; // skip invalid rows

          // Levels (BASIC / ADVANCED / EXTREME)
          const levelContainer = liNodes?.[2]?.querySelector("ul");
          let levels: number[] = [];
          if (levelContainer) {
            // Extract all numeric tokens in order
            const text = levelContainer.textContent || "";
            const matches = text.match(/\d+(?:\.\d+)?/g) || [];
            levels = matches.slice(0, 3).map((v) => parseFloat(v));
          }

          const charts: EagateSong["charts"] = [];
          const diffSeq: Chart["diffClass"][] = [
            "basic",
            "advanced",
            "extreme",
          ];
          for (const [i, diffClass] of diffSeq.entries()) {
            const lvl = levels[i];
            if (typeof lvl === "number" && !Number.isNaN(lvl)) {
              charts.push({ style: "solo", diffClass, lvl });
            }
          }

          songs.push({
            name,
            artist: artist === "-" ? "" : artist,
            ...normalized.get(saHash),
            saHash,
            charts,
            jacketUrl,
          });
        } catch (e) {
          console.error("Failed to parse a song entry:", e);
        }
      });

      return songs;
    }
  }

  /**
   * Compares two song objects for equality
   */
  songEquals(existingSong: Song, fetchedSong: EagateSong): boolean {
    return existingSong.saHash === fetchedSong.saHash;
  }

  /**
   * Merges data from fetchedSong into existingSong
   * @returns True if the merge resulted in any updates
   */
  merge(existingSong: Song, fetchedSong: EagateSong): boolean {
    let hasUpdates = false;

    // Update name if different
    if (existingSong.name !== fetchedSong.name) {
      console.log(
        `Updated song name: "${existingSong.name}" -> "${fetchedSong.name}"`,
      );
      existingSong.name = fetchedSong.name;
      hasUpdates = true;
    }

    // Update artist if different
    if (existingSong.artist !== fetchedSong.artist) {
      console.log(
        `Updated "${fetchedSong.name}" artist: "${existingSong.artist}" -> "${fetchedSong.artist}"`,
      );
      existingSong.artist = fetchedSong.artist;
      hasUpdates = true;
    }

    // Update charts
    for (const fetchedChart of fetchedSong.charts) {
      const existingChart = existingSong.charts.find(
        (chart) =>
          chart.style === fetchedChart.style &&
          chart.diffClass === fetchedChart.diffClass,
      );

      if (!existingChart) {
        console.log(
          `Added "${fetchedSong.name}": [${fetchedChart.style}/${fetchedChart.diffClass}] (Lv.${fetchedChart.lvl})`,
        );
        existingSong.charts.push({ ...fetchedChart });
        hasUpdates = true;
        continue;
      }

      // Update level if different
      if (existingChart.lvl !== fetchedChart.lvl) {
        console.log(
          `Updated "${fetchedSong.name}" [${fetchedChart.style}/${fetchedChart.diffClass}] level: ${existingChart.lvl} -> ${fetchedChart.lvl}`,
        );
        existingChart.lvl = fetchedChart.lvl;
        hasUpdates = true;
      }
    }

    // Try to get jacket if missing
    if (!existingSong.jacket && fetchedSong.jacketUrl) {
      const jacketFilename = `jubeat/${fetchedSong.saHash}`;
      const jacket = downloadJacket(fetchedSong.jacketUrl, jacketFilename);
      if (jacket) {
        console.log(`Added "${existingSong.name}" jacket: ${jacket}`);
        existingSong.jacket = jacket;
        hasUpdates = true;
      }
    }

    return hasUpdates;
  }
}

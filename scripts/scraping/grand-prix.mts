import { getDom } from "../utils.mts";
import type { Song } from "../../src/models/SongData.ts";
import type { DDRSongImporter } from "./ddr-sources.mts";

/**
 * Corrections for song names that need to be standardized
 */
const corrections = new Map<string, string>([
  ["MY SUMMER LOVE(TOMMY’S SMILE MIX)", "MY SUMMER LOVE(TOMMY'S SMILE MIX)"],
  ["BURNIN’ THE FLOOR(BLUE FIRE mix)", "BURNIN' THE FLOOR(BLUE FIRE mix)"],
  ["ちくわパフェだよ☆CKP", "ちくわパフェだよ☆ＣＫＰ"],
]);

export class GrandPrixSongImporter
  implements DDRSongImporter<Pick<Song, "name" | "artist">>
{
  /** URL to DDR song list page */
  readonly #songListUrl: string;

  /**
   * @param songListUrl URL to DDR song list page
   */
  constructor(songListUrl: string) {
    this.#songListUrl = songListUrl;
  }

  async fetchSongs(): Promise<Pick<Song, "name" | "artist">[]> {
    console.log(`Starting to fetch song data from KONAMI DDR GRAND PRIX page`);
    const songs: Pick<Song, "name" | "artist">[] = [];

    const dom = await getDom(this.#songListUrl);
    if (!dom) {
      console.error("Failed to fetch or parse the page");
      return songs;
    }

    const tables = dom.window.document.querySelectorAll("table");
    for (const table of tables) {
      const rows = table.querySelectorAll("tr");
      for (const row of rows) {
        const cells = row.querySelectorAll("td");

        // Process rows with 2 or more cells without colspan attribute
        if (cells.length >= 2) {
          const rawSongName = cells[0]?.textContent?.trim() || "";
          const name = corrections.get(rawSongName) ?? rawSongName;
          const artist = cells[1]?.textContent?.trim() || "";

          if (
            name &&
            !songs.find((s) => s.name === name && s.artist === artist)
          )
            songs.push({ name, artist });
        }
      }
    }

    console.log(
      `Fetched ${songs.length} songs from KONAMI DDR GRAND PRIX page`,
    );
    return songs;
  }

  songEquals(
    existingSong: Song,
    fetchedSong: Pick<Song, "name" | "artist">,
  ): boolean {
    return (
      existingSong.name === fetchedSong.name &&
      existingSong.artist === fetchedSong.artist
    );
  }

  merge(
    _existingSong: Song,
    _fetchedSong: Pick<Song, "name" | "artist">,
  ): boolean {
    // No additional properties to merge
    return false;
  }
}

import { getDom } from "../utils.mts";
import type { Song } from "../../src/models/SongData.ts";
import type { DDRSongImporter } from "./ddr-sources.mts";

/**
 * Corrections for song names that need to be standardized
 */
const corrections = new Map<string, Partial<Pick<Song, "name" | "artist">>>([
  [
    "MY SUMMER LOVE(TOMMY’S SMILE MIX)",
    { name: "MY SUMMER LOVE(TOMMY'S SMILE MIX)" },
  ],
  [
    "BURNIN’ THE FLOOR(BLUE FIRE mix)",
    { name: "BURNIN' THE FLOOR(BLUE FIRE mix)" },
  ],
  ["ちくわパフェだよ☆CKP", { name: "ちくわパフェだよ☆ＣＫＰ" }],
  [
    "Blind Justice ～Torn souls, Hurt Faiths ～",
    { name: "Blind Justice ～Torn souls, Hurt Faiths～" },
  ],
  ["BURNING HEAT！（3 Option MIX）", { name: "BURNING HEAT! (3 Option MIX)" }],
  [
    "DDR TAGMIX -LAST DanceR-",
    { artist: 'BEMANI Sound Team "TAG underground overlay UNLEASHED"' },
  ],
  ["DoLL", { artist: "TЁЯRA" }],
  ["ever snow", { artist: "TЁЯRA" }],
  ["Feidie", { artist: "A-One feat.Napoleon" }],
  [
    "GRADIUS REMIX（↑↑↓↓←→←→BA Ver.)",
    { name: "GRADIUS REMIX (↑↑↓↓←→←→BA Ver.)" },
  ],
  ["MAX 360", { artist: 'BEMANI Sound Team "[𝑥]"' }],
  ["RED ZONE", { artist: "Tatsh&NAOKI" }],
  ["Sacred Oath", { artist: "TЁЯRA" }],
  ["STARS☆☆☆(2nd NAOKI's style)", { artist: "TЁЯRA" }],
  ["STARS☆☆☆（Re-tuned by HΛL） - DDR EDITION -", { artist: "TЁЯRA" }],
  [
    "チュッチュ♪マチュピチュ",
    {
      artist:
        'ななひら,Nana Takahashi,猫体質 by BEMANI Sound Team "劇ダンサーレコード"',
    },
  ],
  ["ロンロンへ ライライライ！", { name: "ロンロンへ　ライライライ！" }],
  ["夢幻ノ光", { artist: "TЁЯRA" }],
  ["恋閃繚乱", { artist: "2B-Waves" }],
  ["華爛漫 -Flowers-", { artist: "TЁЯRA" }],
  [
    "野球の遊び方 そしてその歴史 ～決定版～",
    { name: "野球の遊び方　そしてその歴史　～決定版～" },
  ],
  ["零 - ZERO -", { artist: "TЁЯRA" }],
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
          const correction = corrections.get(rawSongName);
          const name = correction?.name ?? rawSongName;
          const artist =
            correction?.artist ?? (cells[1]?.textContent?.trim() || "");

          if (
            rawSongName &&
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

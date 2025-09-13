// @ts-check
/** @typedef {import("../../src/models/SongData.ts").Song} Song */
/** @typedef {import("../../src/models/SongData.ts").Chart} Chart */

import he from "he";
import { TextDecoderStream, ReadableStream } from "node:stream/web";

/** Song importer from Skill Attack */
export class SkillAttackSongImporter {
  /**
   * Fetches song data from Skill Attack
   * @returns {Promise<(Required<Pick<Song, "name" | "artist" | "saHash" | "saIndex" | "charts">>)[]>}
   */
  async fetchSongs() {
    console.log(`Starting to fetch song data from Skill Attack`);
    const url = "http://skillattack.com/sa4/data/master_music.txt";
    const resp = await fetch(url);

    const decoder = new TextDecoderStream("Shift_JIS");
    resp.body.pipeTo(decoder.writable);

    const data = [];
    for await (const rawLine of lineByLine(decoder.readable)) {
      // saIndex, saHash, [levels of charts(9)], name, artist
      const [saIndex, saHash, ...fields] = rawLine.split("\t");
      if (!saIndex || !saHash || fields.length < 11) continue;

      const charts = [
        { style: "single", diffClass: "beginner" },
        { style: "single", diffClass: "basic" },
        { style: "single", diffClass: "difficult" },
        { style: "single", diffClass: "expert" },
        { style: "single", diffClass: "challenge" },
        { style: "double", diffClass: "basic" },
        { style: "double", diffClass: "difficult" },
        { style: "double", diffClass: "expert" },
        { style: "double", diffClass: "challenge" },
      ]
        .map((v, i) => ({ lvl: parseInt(fields[i], 10), ...v }))
        .filter((v) => v.lvl >= 0); // SA charts have -1 for missing charts
      data.push({
        saHash,
        saIndex,
        name: he.decode(fields[9]), // decode HTML entities (like &hearts;)
        artist: he.decode(fields[10]), // decode HTML entities (like &hearts;)
        charts,
      });
    }
    return data;

    /**
     * Split text file stream into lines
     * @param {ReadableStream<string>} input
     */
    async function* lineByLine(input) {
      const reader = input.getReader();
      let partialLine = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (partialLine) yield partialLine;
          return;
        }

        const lines = (partialLine + value).split("\n");
        partialLine = lines.pop();
        yield* lines;
      }
    }
  }

  /**
   * Compares two song objects for equality
   * @param {Song} existingSong
   * @param {Awaited<ReturnType<SkillAttackSongImporter["fetchSongs"]>>[number]} saSong
   * @returns {boolean} True if songs are considered equal (same saHash)
   */
  static songEquals(existingSong, saSong) {
    return existingSong.saHash === saSong.saHash;
  }

  /**
   * Merges data from an `saSong` into `existingSong` object.
   * @summary This function with side effects that change `existingSong` object
   * @param {Song} existingSong Existing song object to update
   * @param {Awaited<ReturnType<SkillAttackSongImporter["fetchSongs"]>>[number]} saSong Song data from Skill Attack
   * @param {string[]} _unmanagedFlags Flags to preserve (unused)
   * @returns {boolean} True if the merge resulted in any updates
   */
  static merge(existingSong, saSong, _unmanagedFlags = []) {
    let hasUpdates = false;

    // update charts
    for (const chart of saSong.charts) {
      const existingChart = existingSong.charts.find(
        (c) => c.style === chart.style && c.diffClass === chart.diffClass,
      );

      if (!existingChart) {
        console.log(
          `Added "${existingSong.name}": [${chart.style}/${chart.diffClass}] (Lv.${chart.lvl})`,
        );
        existingSong.charts.push(chart);
        hasUpdates = true;
        continue;
      }

      // Update level if different
      if (existingChart.lvl !== chart.lvl) {
        console.log(
          `Updated "${existingSong.name}" [${chart.style}/${chart.diffClass}] level: ${existingChart.lvl} -> ${chart.lvl}`,
        );
        existingChart.lvl = chart.lvl;
        hasUpdates = true;
      }
    }

    // Update saHash & saIndex
    if (existingSong.saHash !== saSong.saHash) {
      existingSong.saHash = saSong.saHash;
      hasUpdates = true;
    }
    if (existingSong.saIndex !== saSong.saIndex) {
      existingSong.saIndex = saSong.saIndex;
      hasUpdates = true;
    }

    return hasUpdates;
  }
}

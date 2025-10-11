// @ts-check
import { decode } from "html-entities";
import { TextDecoderStream, ReadableStream } from "node:stream/web";

const difficultyByIndex = [
  "beginner",
  "basic",
  "difficult",
  "expert",
  "challenge",
  "basic",
  "difficult",
  "expert",
  "challenge",
];

const singlesColumnCount = 5;

/** @typedef {{lvl: number, style: "double" | "single", diffClass: string }} SaChart */
/** @typedef {{ saHash: string, saIndex: string, name: string, artist: string, charts: Array<SaChart> }} SaData */

/**
 * @param {Function} log
 * @returns {Promise<Array<SaData>>}
 */
export async function getSongsFromSkillAttack(log) {
  log("fetching data from skillattack.com");
  const resp = await fetch("http://skillattack.com/sa4/data/master_music.txt");

  const decoder = new TextDecoderStream("Shift_JIS");
  resp.body.pipeTo(decoder.writable);
  /** @type {Array<SaData>} */
  const data = [];
  for await (const rawLine of lineByLine(decoder.readable)) {
    const [index, hash, ...fields] = rawLine.split("\t");
    if (!index || !hash || fields.length < 11) {
      log("skipping unusable SA line");
      continue;
    }
    /** @type {Array<SaChart>} */
    const charts = [];
    let i = 0;
    for (const field of fields) {
      i++;
      if (i > 9) break;
      const lvl = parseInt(field, 10);
      if (lvl < 0) continue;
      charts.push({
        lvl,
        style: i > singlesColumnCount ? "double" : "single",
        diffClass: difficultyByIndex[i - 1],
      });
    }
    data.push({
      saHash: hash,
      saIndex: index,
      name: decode(fields[9]),
      artist: decode(fields[10]),
      charts,
    });
  }

  return data;
}

/**
 *
 * @param {SaData[]} data
 * @returns {Record<string, SaData>}
 */
export function indexSaData(data) {
  /** @type {Record<string, SaData>} */
  let ret = {};
  for (const song of data) {
    ret[song.saHash] = song;
  }
  return ret;
}

/**
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

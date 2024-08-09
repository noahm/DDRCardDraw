import type { I18NDict } from "../models/SongData";

// add some old odd browser properties
declare const navigator: Navigator & {
  userLanguage?: string;
  browserLanguage?: string;
};

const browserLanguage: string =
  (navigator.languages && navigator.languages[0]) ||
  navigator.language ||
  navigator.userLanguage ||
  navigator.browserLanguage ||
  "en";

export const detectedLanguage = browserLanguage.slice(0, 2);

export function zeroPad(n: number, digits: number) {
  let ret = n.toString();
  while (ret.length < digits) {
    ret = "0" + ret;
  }
  return ret;
}

/**
 * Terse looping helper, one indexed
 * @param {number} n number of times to loop
 * @param {(n: number) => T} cb will be executed n times, where N is one-indexed
 * @returns {Array<T>} the collected return values of cb
 */
export function times<T>(n: number, cb: (n: number) => T): Array<T> {
  const results = [];
  for (let i = 1; i <= n; i++) {
    results.push(cb(i));
  }
  return results;
}

export function getDefault(a: number[], i: any, d: number): number {
  return (i in a && a[i]) || d;
}

export function* flattenedKeys(
  input: I18NDict,
): Generator<[string, string], void> {
  for (const key in input) {
    const value = input[key];
    if (typeof value === "string") {
      yield [key, value];
    } else {
      for (const flattenedValue of flattenedKeys(value)) {
        yield [`${key}.${flattenedValue[0]}`, flattenedValue[1]];
      }
    }
  }
}

interface AvailableGameData {
  type: "game";
  index: number;
  name: string;
  display: string;
  parent: string;
}

interface GameDataParent {
  type: "parent";
  name: string;
  games: Array<AvailableGameData>;
}

/** ordered list of all available game data files */
export const availableGameData = (
  (process.env.DATA_FILES as Array<
    Omit<AvailableGameData, "type" | "index">
  >) || []
).sort((a, b) => {
  const parentDiff = a.parent.localeCompare(b.parent);
  if (parentDiff) {
    return parentDiff;
  }
  return a.display.localeCompare(b.display);
});

export function groupGameData(gd: typeof availableGameData) {
  return gd.reduce<Array<AvailableGameData | GameDataParent>>(
    (acc, curr, index) => {
      const asGame: AvailableGameData = {
        type: "game",
        index,
        ...curr,
      };
      if (!curr.parent) {
        acc.push(asGame);
        return acc;
      }
      const latest = acc.length ? acc[acc.length - 1] : undefined;
      if (latest && latest.type === "parent" && latest.name === curr.parent) {
        latest.games.push(asGame);
      } else {
        acc.push({
          type: "parent",
          name: curr.parent,
          games: [asGame],
        });
      }
      return acc;
    },
    [],
  );
}

export function firstOf<T>(iter: IterableIterator<T>): T | undefined {
  const next = iter.next();
  if (!next.done) {
    return next.value;
  }
}

/**
 * Range, inclusive
 */
export function* rangeI(start: number, end: number) {
  for (let i = start; i <= end; i++) {
    yield i;
  }
}

/**
 * Split an array up into chunks of a regular size
 * @param chunkSize
 * @param arr
 */
export function* chunkBy<T>(chunkSize: number, arr: Array<T>) {
  let index = 0;
  while (index < arr.length) {
    yield arr.slice(index, index + chunkSize);
    index += chunkSize;
  }
}

export function* chunkInPieces<T>(pieces: number, arr: Array<T>) {
  let index = 0;
  let chunksYielded = 0;
  let chunkSize = Math.round(arr.length / pieces);
  if (chunkSize === 0) {
    console.warn("Too many pieces to chunk this small an array", {
      pieces,
      arr,
    });
    chunkSize = 1;
  }
  while (index < arr.length) {
    if (chunksYielded + 1 === pieces) {
      // this is our last chunk, so just return the rest of the array
      yield arr.slice(index);
      return;
    }
    yield arr.slice(index, index + chunkSize);
    chunksYielded++;
    index += chunkSize;
  }
}

/**
 * is this an accurate F-Y shuffle? who knows!?!
 */
export function shuffle<Item>(arr: Array<Item>): Array<Item> {
  const ret = arr.slice();
  for (let i = 0; i < ret.length; i++) {
    const randomUpcomingIndex =
      i + Math.floor(Math.random() * (ret.length - i));
    const currentItem = ret[i];
    ret[i] = ret[randomUpcomingIndex];
    ret[randomUpcomingIndex] = currentItem;
  }
  return ret;
}

export function pickRandomItem<T>(
  list: Array<T>,
): [idx: number, item: T] | [undefined, undefined] {
  if (!list.length) {
    return [undefined, undefined];
  }
  const idx = Math.floor(Math.random() * list.length);
  const item = list[idx];
  return [idx, item];
}

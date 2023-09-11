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
  process.env.DATA_FILES as unknown as Array<
    Omit<AvailableGameData, "type" | "index">
  >
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
 * Data structure to count the number of times a given item is added
 */
export class CountingSet<T> implements ReadonlyCountingSet<T> {
  static fromEntries<T>(entries: Array<[T, number]>): CountingSet<T> {
    const ret = new CountingSet<T>();
    ret.items = new Map(entries);
    return ret;
  }

  private items = new Map<T, number>();
  constructor(initialItems: ReadonlyArray<T> = []) {
    for (const item of initialItems) {
      this.add(item);
    }
  }

  public get size() {
    return this.items.size;
  }

  /** returns new count */
  public add(item: T, amt = 1) {
    const next = this.get(item) + amt;
    this.items.set(item, next);
    return next;
  }

  public get(item: T) {
    return this.items.get(item) || 0;
  }

  public has(item: T) {
    return this.items.has(item);
  }

  public values() {
    return this.items.keys();
  }

  public valuesWithCount() {
    return this.items.entries();
  }

  public freeze() {
    return this as ReadonlyCountingSet<T>;
  }
}

export interface ReadonlyCountingSet<T> {
  size: number;
  get(item: T): number;
  has(item: T): boolean;
  values(): IterableIterator<T>;
  valuesWithCount(): IterableIterator<[T, number]>;
}

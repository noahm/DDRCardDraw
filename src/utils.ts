const browserLanguage: string =
  (window.navigator.languages && window.navigator.languages[0]) ||
  window.navigator.language ||
  // @ts-ignore
  window.navigator.userLanguage ||
  // @ts-ignore
  window.navigator.browserLanguage ||
  "en";

export const detectedLanguage = browserLanguage.slice(0, 2);

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

export function* flattenedKeys(
  input: Record<string, string | Record<string, string>>
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

export const availableGameData = (
  process.env.DATA_FILES as unknown as Array<{
    name: string;
    display: string;
  }>
).sort((a, b) => (a.display < b.display ? -1 : 1));

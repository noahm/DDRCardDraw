interface Navigator {
  userLanguage: string;
  browserLanguage: string;
}

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

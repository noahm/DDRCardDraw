/**
 * @type {string}
 */
const browserLanguage =
  (window.navigator.languages && window.navigator.languages[0]) ||
  window.navigator.language ||
  window.navigator.userLanguage ||
  window.navigator.browserLanguage ||
  "en";

export const detectedLanguage = browserLanguage.slice(0, 2);

/**
 * Terse looping helper, one indexed
 * @param {number} n number of times to loop
 * @param {(n: number) => T} cb will be executed n times, where N is one-indexed
 * @returns {Array<T>} the collected return values of cb
 * @template T
 */
export function times(n, cb) {
  const results = [];
  for (let i = 1; i <= n; i++) {
    results.push(cb(i));
  }
  return results;
}

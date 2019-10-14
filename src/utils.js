export const TOURNAMENT_MODE = false;

export const detectedLanguage =
  (window.navigator.languages && window.navigator.languages[0]) ||
  window.navigator.language ||
  window.navigator.userLanguage ||
  window.navigator.browserLanguage;

/**
 * Terse looping helper
 * @param {number} n number of times to loop
 * @param {function} cb will be executed n times, where N is one-indexed
 * @returns an array of the collected return values of cb
 */
export function times(n, cb) {
  const results = [];
  for (let i = 1; i <= n; i++) {
    results.push(cb(i));
  }
  return results;
}

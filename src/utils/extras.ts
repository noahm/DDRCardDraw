/**
 * Helpers for the generic `extras` array carried on songs and charts. `extras`
 * is the game-agnostic channel for cosmetic, game-specific data: rather than
 * adding bespoke fields to the schema (which is meant to stay game-agnostic), a
 * card variant stashes its data here under a `${key}:` prefix and reads it back
 * out in its own variant-specific code.
 */

/**
 * Read the value of a `${key}:`-prefixed entry out of an `extras` array, or
 * undefined if no such entry is present. Returns the first match.
 */
export function readExtra(
  extras: string[] | undefined,
  key: string,
): string | undefined {
  const prefix = `${key}:`;
  const found = extras?.find((entry) => entry.startsWith(prefix));
  return found?.slice(prefix.length);
}

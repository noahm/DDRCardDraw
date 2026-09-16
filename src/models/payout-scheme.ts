/**
 * A gauntlet's payout table, written as a scheme instead of a fixed list.
 *
 * A fixed list has to be rewritten every time the size of a heat changes: a
 * table meant for four players pays nothing to the fifth. A scheme is written
 * in terms of `n`, the number of players in the draw, so one line covers a heat
 * of any size and an organizer can add a late entrant without touching it.
 */

/**
 * One place's payout: `multiplier * n + offset`, where `n` is the size of the
 * heat. A plain number is just an offset with no multiplier.
 */
interface PayoutTerm {
  multiplier: number;
  offset: number;
}

export interface PayoutScheme {
  /** payouts written out by hand, highest place first */
  terms: PayoutTerm[];
  /**
   * Whether the scheme ended in `…`: keep stepping past the written terms, by
   * the difference between the last two, until the whole heat is covered.
   */
  continues: boolean;
}

export type PayoutParse =
  | { ok: true; scheme: PayoutScheme }
  /** why the text can't be read, phrased for someone editing the field */
  | { ok: false; error: string };

/**
 * Reverse the finishing order, so last place earns 1 and every place above it
 * earns one more, then hand first place a bonus point on top. A heat of five
 * pays 6, 4, 3, 2, 1.
 */
export const DEFAULT_PAYOUT_SCHEME = "n+1, n-1, n-2, …";

/** both spellings of the trailing "and so on", since `…` is hard to type */
const ELLIPSIS = /^(…|\.\.\.)$/;
/** `n`, `n+2`, `n-1`, `2n`, `3n+1`, … */
const IN_TERMS_OF_N = /^(\d*)n([+-]\d+)?$/;
const CONSTANT = /^[+-]?\d+$/;

export function parsePayoutScheme(raw: string): PayoutParse {
  const pieces = raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .split(",")
    .filter((piece) => piece.length);
  if (!pieces.length) {
    return { ok: false, error: "enter at least one payout" };
  }

  const terms: PayoutTerm[] = [];
  let continues = false;
  for (const [index, piece] of pieces.entries()) {
    if (ELLIPSIS.test(piece)) {
      if (index !== pieces.length - 1) {
        return { ok: false, error: "… only goes at the end" };
      }
      continues = true;
      continue;
    }
    const inTermsOfN = IN_TERMS_OF_N.exec(piece);
    if (inTermsOfN) {
      terms.push({
        multiplier: inTermsOfN[1] ? Number.parseInt(inTermsOfN[1], 10) : 1,
        offset: inTermsOfN[2] ? Number.parseInt(inTermsOfN[2], 10) : 0,
      });
      continue;
    }
    if (CONSTANT.test(piece)) {
      terms.push({ multiplier: 0, offset: Number.parseInt(piece, 10) });
      continue;
    }
    return {
      ok: false,
      error: `can't read "${piece}" — try a number, n, or n±1`,
    };
  }

  if (!terms.length) {
    return { ok: false, error: "… needs a payout to continue from" };
  }
  return { ok: true, scheme: { terms, continues } };
}

/**
 * What each place earns in a heat of `playerCount`, highest place first.
 *
 * The table only ever covers places somebody can actually finish in: a scheme
 * written for a bigger group is cut off at the size of this one, and a scheme
 * that counts itself down to nothing ends where it runs out. Both leave the
 * table exactly as long as the payouts it really makes, which is what the
 * preview in the editor shows.
 */
export function evaluatePayoutScheme(
  scheme: PayoutScheme,
  playerCount: number,
): number[] {
  const value = (term: PayoutTerm) =>
    Math.max(0, term.multiplier * playerCount + term.offset);
  const table = scheme.terms.map(value).slice(0, playerCount);

  if (scheme.continues) {
    // two written terms set the pace; a lone one falls back to counting down,
    // which is what "5, …" plainly means
    const step =
      scheme.terms.length > 1
        ? value(scheme.terms[scheme.terms.length - 1]) -
          value(scheme.terms[scheme.terms.length - 2])
        : -1;
    while (table.length < playerCount) {
      const next = table[table.length - 1] + step;
      if (next <= 0) {
        break;
      }
      table.push(next);
    }
  }

  // a place paying nothing is the same as no place at all
  while (table.length && table[table.length - 1] === 0) {
    table.pop();
  }
  return table;
}

/**
 * The payout table `raw` describes for a heat of `playerCount`, falling back to
 * the default scheme when it's blank or unreadable. Display code that has to
 * render something always has a table; the editor uses `parsePayoutScheme`
 * directly so it can say what's wrong instead.
 */
export function payoutTableFromScheme(
  raw: string | undefined,
  playerCount: number,
): number[] {
  const parsed = parsePayoutScheme(raw || DEFAULT_PAYOUT_SCHEME);
  const scheme = parsed.ok
    ? parsed.scheme
    : // the default is a literal in this file, so it always parses
      (parsePayoutScheme(DEFAULT_PAYOUT_SCHEME) as { scheme: PayoutScheme })
        .scheme;
  return evaluatePayoutScheme(scheme, playerCount);
}

/** "1st", "2nd", … for labelling a place in the payout preview */
export function ordinalPlace(place: number) {
  const tens = place % 100;
  if (tens >= 11 && tens <= 13) {
    return `${place}th`;
  }
  switch (place % 10) {
    case 1:
      return `${place}st`;
    case 2:
      return `${place}nd`;
    case 3:
      return `${place}rd`;
    default:
      return `${place}th`;
  }
}

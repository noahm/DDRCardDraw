/**
 * The player-specific values a `player/<n>` source can show, in the order they
 * render. Adding an entry here lists it in the dashboard's source picker on its
 * own; the matching case in `CabPlayer` is a type error until it's written.
 *
 * Each carries the key of its label rather than the label, so this stays a
 * plain module the source routes import without an intl context in hand.
 */
export const playerFields = [
  { key: "name", labelKey: "obsDashboard.fieldName" },
  { key: "pronouns", labelKey: "obsDashboard.fieldPronouns" },
  { key: "score", labelKey: "obsDashboard.fieldScore" },
] as const;

export type PlayerField = (typeof playerFields)[number]["key"];

const allFieldKeys = playerFields.map((field) => field.key);

/** what `player/<n>` showed back when the field list wasn't configurable */
export const defaultPlayerFields: PlayerField[] = ["name", "score"];

/**
 * Reads a source url's comma separated field list, keeping render order. Names
 * we don't know are dropped, and a list with nothing left in it falls back to
 * the original name-and-score pairing rather than rendering a blank source.
 */
export function toPlayerFields(input: string | undefined): PlayerField[] {
  if (!input) return defaultPlayerFields;
  const requested = new Set(input.split(","));
  const known = allFieldKeys.filter((key) => requested.has(key));
  return known.length ? known : defaultPlayerFields;
}

/** sorts an arbitrary set of fields back into the order they render in */
export function inRenderOrder(fields: Iterable<PlayerField>): PlayerField[] {
  const wanted = new Set(fields);
  return allFieldKeys.filter((key) => wanted.has(key));
}

/** path stub for one player source, e.g. `player/2/name,score` */
export const playerSourceStub = (player: number, fields: PlayerField[]) =>
  `player/${player}/${fields.join(",")}`;

/**
 * Whether a cards source shows the charts a match has banned.
 *
 * The room's own "hide vetos" setting decides by default, which is what these
 * urls did before they could say anything about it. That setting is shared by
 * everyone in the room though, so it can't answer two scenes at once: a stream
 * showing the bans while the operator's dock hides them, or one layout per cab
 * that differs from the room's default. A `?vetos=` on the source url settles
 * it for that source alone.
 */
export const vetoModes = [
  { key: "room", label: "Room setting" },
  { key: "show", label: "Show vetos" },
  { key: "hide", label: "Hide vetos" },
] as const;

export type VetoMode = (typeof vetoModes)[number]["key"];

/** search param a cards source states its veto mode in */
export const VETOS_PARAM = "vetos";

/** what a cards source did back when it had no say in the matter */
export const defaultVetoMode: VetoMode = "room";

const knownModes = vetoModes.map((mode) => mode.key);

/**
 * Reads a source url's `?vetos=`. A value we don't know defers to the room
 * rather than picking one of the overrides for the operator: a typo shouldn't
 * silently mean the opposite of what the room asked for.
 */
export function toVetoMode(input: string | null): VetoMode {
  const match = knownModes.find((mode) => mode === input);
  return match || defaultVetoMode;
}

/**
 * How this mode answers "hide banned charts", or null to leave the question to
 * the room's setting.
 */
export function hidesVetos(mode: VetoMode): boolean | null {
  switch (mode) {
    case "show":
      return false;
    case "hide":
      return true;
    case "room":
      return null;
  }
}

/** path stub for a cards source, e.g. `cards` or `cards?vetos=hide` */
export const cardsSourceStub = (mode: VetoMode) =>
  mode === defaultVetoMode
    ? "cards"
    : `cards?${new URLSearchParams({ [VETOS_PARAM]: mode })}`;

/**
 * Whether a cards source shows the charts a match has banned.
 *
 * Every other client answers this for itself, out of its own local settings
 * (`src/state/local-settings.atoms.ts`). An OBS source can't: it's a browser
 * sitting in a scene that nobody ever opens settings in, and its storage is
 * whatever that copy of OBS happens to have. So the url carries the answer,
 * and it is the whole answer — there's no room-wide value behind it to defer
 * to, which is what lets two scenes off the same cab disagree.
 *
 * A url with no `?vetos=` at all shows them, which is what an unconfigured
 * room did back when this was the room's call, so a source pasted into OBS
 * before this existed keeps doing what it was doing.
 *
 * Each mode carries the key of its label rather than the label, so this stays
 * a plain module the OBS route can import without dragging react-intl in with
 * it. Only the dashboard ever renders one, and it has an intl context.
 */
export const vetoModes = [
  { key: "show", labelKey: "controls.vetosShow" },
  { key: "hide", labelKey: "controls.vetosHide" },
] as const;

export type VetoMode = (typeof vetoModes)[number]["key"];

/** search param a cards source states its veto mode in */
export const VETOS_PARAM = "vetos";

/** what a cards source does when its url doesn't say */
export const defaultVetoMode: VetoMode = "show";

const knownModes = vetoModes.map((mode) => mode.key);

/**
 * Reads a source url's `?vetos=`. A value we don't know falls back to the
 * default rather than to the other mode: a typo shouldn't silently mean the
 * opposite of what was typed.
 */
export function toVetoMode(input: string | null): VetoMode {
  const match = knownModes.find((mode) => mode === input);
  return match || defaultVetoMode;
}

/** how this mode answers "hide banned charts" */
export function hidesVetos(mode: VetoMode): boolean {
  return mode === "hide";
}

/**
 * Path stub for a cards source, e.g. `cards?vetos=hide`. Always spelled out,
 * even for the default: the url is the only place this is written down now, so
 * a source pasted into OBS should say what it does on its face.
 */
export const cardsSourceStub = (mode: VetoMode) =>
  `cards?${new URLSearchParams({ [VETOS_PARAM]: mode })}`;

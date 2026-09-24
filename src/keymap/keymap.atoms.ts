import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * User-remappable keys, for arcade cabinets whose button panels arrive as
 * ordinary key presses: two sides, each with four directions, a green accept
 * button and a red back button.
 *
 * Bindings are stored by `KeyboardEvent.code`, the physical key, since that is
 * what a keyboard encoder wired to a button reliably sends regardless of
 * keyboard layout or shift state. The map lives in this browser only, across
 * every event and classic mode alike: it describes the machine, not the room.
 */

export type Side = "p1" | "p2";
export const SIDES: Side[] = ["p1", "p2"];

export type ButtonId = "up" | "down" | "left" | "right" | "accept" | "back";
export const BUTTONS: ButtonId[] = [
  "up",
  "down",
  "left",
  "right",
  "accept",
  "back",
];

export interface SideBindings {
  keys: Partial<Record<ButtonId, string>>;
  /**
   * Which player the accept button speaks for on a card, as a 0-based index in
   * display order, like the 1-9 keys. Null makes it a plain Enter.
   */
  acceptAsPlayer: number | null;
}

export interface KeyMap {
  version: 1;
  sides: Record<Side, SideBindings>;
}

export const emptyKeyMap: KeyMap = {
  version: 1,
  sides: {
    p1: { keys: {}, acceptAsPlayer: null },
    p2: { keys: {}, acceptAsPlayer: null },
  },
};

export const keyMapAtom = atomWithStorage<KeyMap>(
  "ddrtools.keymap",
  emptyKeyMap,
  undefined,
  { getOnInit: true },
);

/**
 * True while the settings UI is waiting for a key to bind, so the key goes to
 * the binding rather than being acted on.
 */
export const capturingKeyAtom = atom(false);

export interface Binding {
  side: Side;
  button: ButtonId;
}

/** code -> what it's bound to */
export function bindingsByCode(map: KeyMap) {
  const out = new Map<string, Binding>();
  for (const side of SIDES) {
    const keys = map.sides[side]?.keys || {};
    for (const button of BUTTONS) {
      const code = keys[button];
      if (code) out.set(code, { side, button });
    }
  }
  return out;
}

/** a copy of `map` with `code` bound to `side`/`button`, and nothing else */
export function withBinding(
  map: KeyMap,
  side: Side,
  button: ButtonId,
  code: string | undefined,
): KeyMap {
  const sides = { ...map.sides };
  for (const s of SIDES) {
    const keys = { ...sides[s].keys };
    // a key can only do one thing, so taking it here frees it elsewhere
    for (const b of BUTTONS) {
      if (code && keys[b] === code) delete keys[b];
    }
    if (s === side) {
      if (code) keys[button] = code;
      else delete keys[button];
    }
    sides[s] = { ...sides[s], keys };
  }
  return { ...map, sides };
}

export function useKeyMap() {
  return useAtom(keyMapAtom);
}

/** a short readable name for a `KeyboardEvent.code` */
export function keyLabel(code: string) {
  const arrows: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  if (arrows[code]) return arrows[code];
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  if (m) return m[1];
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

/**
 * The shortcuts the app has without any mapping. Binding one of these keys to
 * a button takes it over, so the built-in shortcut stops working for it.
 */
export const DEFAULT_SHORTCUTS: Record<string, string> = {
  KeyN: "New draw",
  ArrowUp: "Move up",
  ArrowDown: "Move down",
  ArrowLeft: "Move left",
  ArrowRight: "Move right",
  Enter: "Accept",
  NumpadEnter: "Accept",
  Space: "Accept on a card",
  Escape: "Close menus and dialogs",
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => [
      [`Digit${n}`, `Card menu as player ${n}`],
      [`Numpad${n}`, `Card menu as player ${n}`],
    ]),
  ),
};

/**
 * The key each button stands in for. A binding to this very key (the real
 * down arrow bound as "down") changes nothing, so it's left to work natively.
 */
export const NATIVE_KEYS: Record<ButtonId, { key: string; code: string }> = {
  up: { key: "ArrowUp", code: "ArrowUp" },
  down: { key: "ArrowDown", code: "ArrowDown" },
  left: { key: "ArrowLeft", code: "ArrowLeft" },
  right: { key: "ArrowRight", code: "ArrowRight" },
  accept: { key: "Enter", code: "Enter" },
  back: { key: "Escape", code: "Escape" },
};

import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import {
  Binding,
  bindingsByCode,
  capturingKeyAtom,
  KeyMap,
  keyMapAtom,
  NATIVE_KEYS,
} from "./keymap.atoms";
import { GamepadListener } from "./gamepad-listener";
import { perform, synthetic } from "./panel-actions";

/**
 * Turns presses of mapped keys into the keys the app already understands.
 *
 * A mapped key is caught at the window before anything else sees it, so a key
 * taken over by a button no longer does whatever it did by default (N stops
 * opening a draw, a digit stops opening a card's menu), and the button it's
 * bound to is pressed in its place (see `panel-actions.ts`). Gamepad inputs
 * bound in the same map are polled by `GamepadListener`, rendered alongside.
 */
export function KeyMapListener() {
  const keyMap = useAtomValue(keyMapAtom);
  const capturing = useAtomValue(capturingKeyAtom);
  const stateRef = useRef({
    keyMap,
    capturing,
    byCode: bindingsByCode(keyMap),
  });
  useEffect(() => {
    stateRef.current = { keyMap, capturing, byCode: bindingsByCode(keyMap) };
  }, [keyMap, capturing]);

  useEffect(() => {
    /** codes whose keydown was taken over, so their keyup/keypress is too */
    const swallowed = new Set<string>();

    function onKeyDown(e: KeyboardEvent) {
      if (synthetic.has(e)) return;
      const { keyMap, capturing, byCode } = stateRef.current;
      if (capturing || e.ctrlKey || e.metaKey || e.altKey) return;
      const binding = byCode.get(e.code);
      if (!binding) return;
      // Text fields get no exception: a panel wired to letter keys would
      // otherwise have no way to accept or back out of one, and the draw
      // dialog opens with focus in its title. Mapping a letter gives it up
      // for typing, which the settings say.
      if (isNativeEquivalent(binding, keyMap, e)) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      swallowed.add(e.code);
      perform(binding, keyMap);
    }

    function onKeyUpOrPress(e: KeyboardEvent) {
      if (synthetic.has(e) || !swallowed.has(e.code)) return;
      // a swallowed Space would otherwise still click a focused button on
      // release
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === "keyup") swallowed.delete(e.code);
    }

    // registered once, early, so it runs ahead of the capture-phase Escape
    // listeners Mantine's modals add as they open
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keypress", onKeyUpOrPress, { capture: true });
    window.addEventListener("keyup", onKeyUpOrPress, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keypress", onKeyUpOrPress, {
        capture: true,
      });
      window.removeEventListener("keyup", onKeyUpOrPress, { capture: true });
    };
  }, []);

  return <GamepadListener />;
}

/** the pressed key already is what this button would send */
function isNativeEquivalent(binding: Binding, map: KeyMap, e: KeyboardEvent) {
  if (
    binding.button === "accept" &&
    map.sides[binding.side].acceptAsPlayer !== null
  ) {
    return false;
  }
  return NATIVE_KEYS[binding.button].key === e.key;
}

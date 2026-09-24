import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import {
  CARD_NAV_ATTR,
  focusCardFromHeader,
  focusHeader,
  focusIsAdrift,
  NAV_HEADER_ATTR,
} from "../utils/card-nav";
import {
  Binding,
  bindingsByCode,
  ButtonId,
  capturingKeyAtom,
  KeyMap,
  keyMapAtom,
  NATIVE_KEYS,
} from "./keymap.atoms";

/**
 * Turns presses of mapped keys into the keys the app already understands.
 *
 * A mapped key is caught at the window before anything else sees it, so a key
 * taken over by a button no longer does whatever it did by default (N stops
 * opening a draw, a digit stops opening a card's menu). In its place a
 * synthetic arrow, Enter or Escape is dispatched at whatever holds focus,
 * where the existing handlers (cards, Mantine menus and modals, the song
 * search) pick it up. Synthetic events carry no browser default action, so
 * the few defaults that matter are done by hand: accept clicks buttons and
 * submits forms, and a direction nobody handled moves focus along the tab
 * order of the dialog or header it happened in.
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

  return null;
}

/** the events this module dispatches, which it must not translate again */
const synthetic = new WeakSet<Event>();

function dispatchKey(target: EventTarget, key: string, code: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    code,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  synthetic.add(event);
  target.dispatchEvent(event);
  return event;
}

function isEditable(el: HTMLElement) {
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return true;
  }
  return (
    el instanceof HTMLInputElement &&
    !["button", "checkbox", "radio", "submit", "reset", "range"].includes(
      el.type,
    )
  );
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

function focusedElement() {
  return focusIsAdrift()
    ? null
    : (document.activeElement as HTMLElement | null);
}

function perform(binding: Binding, map: KeyMap) {
  const target = focusedElement();
  switch (binding.button) {
    case "back":
      dispatchKey(target || document.body, "Escape", "Escape");
      return;
    case "accept":
      if (!target) {
        // nothing to act on yet: the first press puts focus somewhere useful
        if (!focusCardFromHeader()) focusHeader();
        return;
      }
      accept(target, map.sides[binding.side].acceptAsPlayer);
      return;
    default:
      if (!target) {
        if (!focusCardFromHeader()) focusHeader();
        return;
      }
      move(target, binding.button);
  }
}

function accept(target: HTMLElement, asPlayer: number | null) {
  if (asPlayer !== null && target.matches(`[${CARD_NAV_ATTR}]`)) {
    const digit = String(asPlayer + 1);
    // the card's own 1-9 handling opens its menu for that player; if it
    // couldn't (no such player, or nothing to act on) fall back to Enter
    if (dispatchKey(target, digit, `Digit${digit}`).defaultPrevented) return;
  }
  if (dispatchKey(target, "Enter", "Enter").defaultPrevented) return;
  if (isEditable(target)) {
    // Enter's default in a text field is submitting its form
    if (target instanceof HTMLInputElement) target.form?.requestSubmit();
    return;
  }
  if (
    target.matches(
      "button, a[href], summary, input, [role=button], [role=menuitem], [role=tab], [role=option], [role=checkbox], [role=switch]",
    )
  ) {
    target.click();
  }
}

const TABBABLE =
  "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

function move(target: HTMLElement, direction: ButtonId) {
  const { key, code } = NATIVE_KEYS[direction];
  if (dispatchKey(target, key, code).defaultPrevented) return;

  // nothing claimed the arrow, so step through the tab order instead, within
  // whatever dialog or bar focus is in. The header already answers down (back
  // to the cards), and up has nowhere to go from it.
  const inHeader = target.closest<HTMLElement>(`[${NAV_HEADER_ATTR}]`);
  if (inHeader && (direction === "up" || direction === "down")) return;
  const scope =
    inHeader || target.closest<HTMLElement>("[role=dialog]") || document.body;
  const stops = Array.from(
    scope.querySelectorAll<HTMLElement>(TABBABLE),
  ).filter((el) => el.getClientRects().length > 0);
  const idx = stops.indexOf(target);
  const step = direction === "down" || direction === "right" ? 1 : -1;
  const next = idx === -1 ? stops[0] : stops[idx + step];
  next?.focus();
}

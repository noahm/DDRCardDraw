import {
  CARD_NAV_ATTR,
  focusCardFromHeader,
  focusHeader,
  focusIsAdrift,
  NAV_HEADER_ATTR,
} from "../utils/card-nav";
import { Binding, ButtonId, KeyMap, NATIVE_KEYS } from "./keymap.atoms";

/**
 * What a panel button does when pressed, whether the press came from a mapped
 * key (`keymap-listener.tsx`) or a gamepad (`gamepad-listener.tsx`).
 *
 * Each button is played out as the key it stands in for: a synthetic arrow,
 * Enter or Escape dispatched at whatever holds focus, where the existing
 * handlers (cards, Mantine menus and modals, the song search) pick it up.
 * Synthetic events carry no browser default action, so the few defaults that
 * matter are done by hand: accept clicks buttons and submits forms, and a
 * direction nobody handled moves focus along the tab order of the dialog or
 * header it happened in.
 */

/** the events dispatched here, which the key listener must not translate again */
export const synthetic = new WeakSet<Event>();

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

function focusedElement() {
  return focusIsAdrift()
    ? null
    : (document.activeElement as HTMLElement | null);
}

/** act out a press of a panel button, whether it came from a key or a pad */
export function perform(binding: Binding, map: KeyMap) {
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

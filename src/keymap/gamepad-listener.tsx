import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { activePadInputs, padInputKey, readPads } from "./gamepad";
import { perform } from "./panel-actions";
import {
  ButtonId,
  capturingKeyAtom,
  keyMapAtom,
  padBindings,
} from "./keymap.atoms";

/** how long a held direction waits before repeating, then how often */
const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 120;

const DIRECTIONS = new Set<ButtonId>(["up", "down", "left", "right"]);

/**
 * Polls connected gamepads for the inputs bound in the key map and acts on
 * each new press the way a mapped key would. Held directions repeat, like a
 * held arrow key. The loop only runs while a pad is connected; browsers don't
 * report a pad at all until a button on it has been pressed on this page.
 */
export function GamepadListener() {
  const keyMap = useAtomValue(keyMapAtom);
  const capturing = useAtomValue(capturingKeyAtom);
  const stateRef = useRef({ keyMap, capturing });
  useEffect(() => {
    stateRef.current = { keyMap, capturing };
  }, [keyMap, capturing]);

  useEffect(() => {
    if (typeof navigator.getGamepads !== "function") return;
    let frame = 0;
    /** inputs held as of the last frame: when they went down, last fired */
    const held = new Map<string, { since: number; fired: number }>();

    function tick(now: number) {
      frame = 0;
      const pads = readPads();
      if (!pads.some((p) => p?.connected)) {
        held.clear();
        return; // resumes on the next gamepadconnected
      }
      const { keyMap, capturing } = stateRef.current;
      const bound = new Map(
        padBindings(keyMap).map(({ input, binding }) => [
          padInputKey(input),
          binding,
        ]),
      );
      // Every held input is tracked, bound or not, so that one only fires
      // when it goes down: an input bound while it was being held (the press
      // that bound it in the settings) waits for its next press.
      const active = new Set(activePadInputs(pads).map(padInputKey));
      for (const key of held.keys()) {
        if (!active.has(key)) held.delete(key);
      }
      for (const key of active) {
        const binding = bound.get(key);
        const state = held.get(key);
        if (!state) {
          held.set(key, { since: now, fired: now });
          if (binding && !capturing) perform(binding, keyMap);
        } else if (
          binding &&
          !capturing &&
          DIRECTIONS.has(binding.button) &&
          now - state.since > REPEAT_DELAY_MS &&
          now - state.fired > REPEAT_INTERVAL_MS
        ) {
          state.fired = now;
          perform(binding, keyMap);
        }
      }
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (!frame) frame = requestAnimationFrame(tick);
    }
    window.addEventListener("gamepadconnected", start);
    start();
    return () => {
      window.removeEventListener("gamepadconnected", start);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

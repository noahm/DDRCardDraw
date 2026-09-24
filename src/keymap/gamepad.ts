/**
 * Gamepad inputs that can be bound to panel buttons. The Gamepad API has no
 * events for presses, only state to poll, so everything here reads a snapshot
 * from `navigator.getGamepads()`.
 *
 * A pad is identified by its index, which browsers hand out in the order pads
 * were first used and keep for as long as the page is open. That is what tells
 * apart a cabinet's two sides when both encoders report the same name.
 */

export type PadInput =
  | { pad: number; kind: "button"; index: number }
  /** a stick or d-pad axis pushed past halfway toward `dir` */
  | { pad: number; kind: "axis"; index: number; dir: 1 | -1 };

const THRESHOLD = 0.5;

export function padInputKey(input: PadInput) {
  return input.kind === "button"
    ? `${input.pad}:b${input.index}`
    : `${input.pad}:a${input.index}${input.dir > 0 ? "+" : "-"}`;
}

export function samePadInput(a: PadInput | undefined, b: PadInput) {
  return !!a && padInputKey(a) === padInputKey(b);
}

export function padInputLabel(input: PadInput) {
  const pad = `Pad ${input.pad + 1}`;
  return input.kind === "button"
    ? `${pad} B${input.index}`
    : `${pad} Axis ${input.index}${input.dir > 0 ? "+" : "−"}`;
}

export function readPads(): (Gamepad | null)[] {
  return typeof navigator.getGamepads === "function"
    ? Array.from(navigator.getGamepads())
    : [];
}

/** every input currently held on every pad, for binding one by pressing it */
export function activePadInputs(pads: (Gamepad | null)[]) {
  const out: PadInput[] = [];
  for (const pad of pads) {
    if (!pad?.connected) continue;
    pad.buttons.forEach((button, index) => {
      if (button.pressed || button.value > THRESHOLD) {
        out.push({ pad: pad.index, kind: "button", index });
      }
    });
    pad.axes.forEach((value, index) => {
      if (Math.abs(value) > THRESHOLD) {
        out.push({
          pad: pad.index,
          kind: "axis",
          index,
          dir: value > 0 ? 1 : -1,
        });
      }
    });
  }
  return out;
}

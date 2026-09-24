import { ActionIcon, Button, Group, NativeSelect, Table } from "@mantine/core";
import { IconDeviceGamepad2, IconX } from "@tabler/icons-react";
import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import styles from "../controls/controls.css";
import {
  BUTTONS,
  ButtonId,
  capturingKeyAtom,
  DEFAULT_SHORTCUTS,
  emptyKeyMap,
  keyLabel,
  NATIVE_KEYS,
  Side,
  SIDES,
  useKeyMap,
  withBinding,
  withoutBindings,
  withPadBinding,
} from "./keymap.atoms";
import {
  activePadInputs,
  padInputKey,
  padInputLabel,
  readPads,
} from "./gamepad";

const BUTTON_LABELS: Record<ButtonId, string> = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  accept: "Accept (green)",
  back: "Back (red)",
};

const SIDE_LABELS: Record<Side, string> = { p1: "Side 1", p2: "Side 2" };

/** keys that only modify another, which can't be told apart as a binding */
const MODIFIER_CODES = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

/**
 * Binds keys to the buttons of a two-sided arcade panel. Stored in this
 * browser only (see `keymap.atoms.ts`), and acted on by `KeyMapListener`.
 */
export function KeyMapSettings() {
  const [keyMap, setKeyMap] = useKeyMap();
  const [listening, setListening] = useState<{
    side: Side;
    button: ButtonId;
  } | null>(null);
  const setCapturing = useSetAtom(capturingKeyAtom);

  useEffect(() => {
    setCapturing(!!listening);
    if (!listening) return;
    function onKeyDown(e: KeyboardEvent) {
      if (MODIFIER_CODES.has(e.code) || !e.code) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setKeyMap((prev) =>
        withBinding(prev, listening!.side, listening!.button, e.code),
      );
      setListening(null);
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });

    // Pads are polled for the first input that goes down after listening
    // started. Whatever is already held (the accept button that just clicked
    // this, say) has to be let go first before it counts.
    let frame = 0;
    const heldAtStart = new Set(activePadInputs(readPads()).map(padInputKey));
    function poll() {
      const active = activePadInputs(readPads());
      const activeKeys = new Set(active.map(padInputKey));
      for (const key of heldAtStart) {
        if (!activeKeys.has(key)) heldAtStart.delete(key);
      }
      const pressed = active.find((i) => !heldAtStart.has(padInputKey(i)));
      if (pressed) {
        setKeyMap((prev) =>
          withPadBinding(prev, listening!.side, listening!.button, pressed),
        );
        setListening(null);
        return;
      }
      frame = requestAnimationFrame(poll);
    }
    frame = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      cancelAnimationFrame(frame);
      setCapturing(false);
    };
  }, [listening, setKeyMap, setCapturing]);

  const overridden = SIDES.flatMap((side) =>
    BUTTONS.flatMap((button) => {
      const code = keyMap.sides[side].keys[button];
      if (!code || !DEFAULT_SHORTCUTS[code]) return [];
      const sameAsNative =
        NATIVE_KEYS[button].code === code &&
        !(button === "accept" && keyMap.sides[side].acceptAsPlayer !== null);
      if (sameAsNative) return [];
      return [
        `${keyLabel(code)} (${DEFAULT_SHORTCUTS[code]}) now works as ${SIDE_LABELS[side]} ${BUTTON_LABELS[button]}`,
      ];
    }),
  );

  return (
    <div className={styles.localSettings}>
      <h2>
        <IconDeviceGamepad2 size={20} className={styles.localSettingsIcon} />
        Button Mapping
      </h2>
      <p className={styles.eventSettingsHint}>
        Map the buttons of an arcade panel, whether it shows up as keys or as
        gamepads, to move around, accept and back out. Directions work like the
        arrow keys, and back closes menus and dialogs. A mapped key always acts
        as its button, even in text fields, so a letter mapped here can no
        longer be typed. Saved in this browser for every event.
      </p>
      <Table withRowBorders={false} verticalSpacing={4}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th />
            {SIDES.map((side) => (
              <Table.Th key={side}>{SIDE_LABELS[side]}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {BUTTONS.map((button) => (
            <Table.Tr key={button}>
              <Table.Td>{BUTTON_LABELS[button]}</Table.Td>
              {SIDES.map((side) => {
                const code = keyMap.sides[side].keys[button];
                const pad = keyMap.sides[side].pads?.[button];
                const bound =
                  [code && keyLabel(code), pad && padInputLabel(pad)]
                    .filter(Boolean)
                    .join(" / ") || null;
                const isListening =
                  listening?.side === side && listening.button === button;
                return (
                  <Table.Td key={side}>
                    <Group gap={4} wrap="nowrap">
                      <Button
                        size="xs"
                        miw="8em"
                        variant={isListening ? "filled" : "default"}
                        aria-label={`${SIDE_LABELS[side]} ${BUTTON_LABELS[button]}: ${bound || "not set"}`}
                        onClick={() =>
                          setListening(isListening ? null : { side, button })
                        }
                        onBlur={() => isListening && setListening(null)}
                      >
                        {isListening ? "Press a key or button…" : bound || "—"}
                      </Button>
                      {bound && !isListening && (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          aria-label={`Clear ${SIDE_LABELS[side]} ${BUTTON_LABELS[button]}`}
                          onClick={() =>
                            setKeyMap((prev) =>
                              withoutBindings(prev, side, button),
                            )
                          }
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
          <Table.Tr>
            <Table.Td>Accept on a card</Table.Td>
            {SIDES.map((side) => (
              <Table.Td key={side}>
                <NativeSelect
                  size="xs"
                  w="9.5em"
                  aria-label={`${SIDE_LABELS[side]} accept on a card`}
                  value={String(keyMap.sides[side].acceptAsPlayer ?? "")}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setKeyMap((prev) => ({
                      ...prev,
                      sides: {
                        ...prev.sides,
                        [side]: {
                          ...prev.sides[side],
                          acceptAsPlayer: value === "" ? null : Number(value),
                        },
                      },
                    }));
                  }}
                  data={[
                    { value: "", label: "Open menu" },
                    ...[0, 1, 2, 3].map((i) => ({
                      value: String(i),
                      label: `As player ${i + 1}`,
                    })),
                  ]}
                />
              </Table.Td>
            ))}
          </Table.Tr>
        </Table.Tbody>
      </Table>
      {overridden.length > 0 && (
        <ul className={styles.eventSettingsHint}>
          {overridden.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <Button
        size="xs"
        variant="default"
        mt="xs"
        onClick={() => setKeyMap(emptyKeyMap)}
      >
        Clear all mappings
      </Button>
    </div>
  );
}

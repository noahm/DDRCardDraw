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
} from "./keymap.atoms";

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
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
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
        Map the buttons of an arcade panel (or any keys) to move around, accept
        and back out. Directions work like the arrow keys, and back closes menus
        and dialogs. A mapped key always acts as its button, even in text
        fields, so a letter mapped here can no longer be typed. Saved in this
        browser for every event.
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
                const isListening =
                  listening?.side === side && listening.button === button;
                return (
                  <Table.Td key={side}>
                    <Group gap={4} wrap="nowrap">
                      <Button
                        size="xs"
                        w="8em"
                        variant={isListening ? "filled" : "default"}
                        aria-label={`${SIDE_LABELS[side]} ${BUTTON_LABELS[button]}: ${code ? keyLabel(code) : "not set"}`}
                        onClick={() =>
                          setListening(isListening ? null : { side, button })
                        }
                        onBlur={() => isListening && setListening(null)}
                      >
                        {isListening
                          ? "Press a key…"
                          : code
                            ? keyLabel(code)
                            : "—"}
                      </Button>
                      {code && !isListening && (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          aria-label={`Clear ${SIDE_LABELS[side]} ${BUTTON_LABELS[button]}`}
                          onClick={() =>
                            setKeyMap((prev) =>
                              withBinding(prev, side, button, undefined),
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

import { Badge, Button, Group, TextInput } from "@mantine/core";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import {
  DEFAULT_PAYOUT_SCHEME,
  evaluatePayoutScheme,
  ordinalPlace,
  parsePayoutScheme,
} from "../models/payout-scheme";
import styles from "./payout-scheme-input.css";

interface Props {
  /** the scheme in use, empty to fall back to `inheritedScheme` */
  value: string;
  onCommit: (next: string) => void;
  /**
   * When a keystroke counts as an edit. A dialog's own submit button is
   * confirmation enough where nothing leaves React state until it's pressed.
   * The event setting has no submit of its own and every commit is an action
   * the whole room sees, so it keeps a draft until somebody confirms it rather
   * than dispatching a scheme per keystroke.
   */
  commit: "with-form" | "on-confirm";
  /**
   * Size of the heat to preview a payout for. Leave it off where nothing has
   * settled that yet and the preview grows a stepper of its own.
   */
  playerCount?: number;
  /** what an empty field falls back to; the built-in default when unset */
  inheritedScheme?: string;
}

/**
 * Editor for a gauntlet payout scheme, with the table it works out to sitting
 * right under it. The notation earns its keep by covering a heat of any size,
 * which also means nobody can read a payout straight off the text -- so the
 * preview isn't decoration here, it's how the field is checked.
 *
 * The preview follows what's being typed either way; what `commit` decides is
 * when that typing becomes an edit other people see.
 */
export function PayoutSchemeInput({
  value,
  onCommit,
  commit,
  playerCount,
  inheritedScheme,
}: Props) {
  // only used when the caller has no player count of its own to preview
  const [previewCount, setPreviewCount] = useState(4);
  const [draft, setDraft] = useState(value);
  // follow a value committed elsewhere -- by another client in the room, or by
  // a reset -- unless something has been typed here that hasn't been sent yet
  const [lastSeen, setLastSeen] = useState(value);
  if (value !== lastSeen) {
    setLastSeen(value);
    if (draft === lastSeen) {
      setDraft(value);
    }
  }

  const count = playerCount ?? previewCount;
  const effective = draft.trim() || inheritedScheme || DEFAULT_PAYOUT_SCHEME;
  const parsed = parsePayoutScheme(effective);
  const table = parsed.ok ? evaluatePayoutScheme(parsed.scheme, count) : [];
  const unsent = commit === "on-confirm" && draft !== value;

  function handleChange(next: string) {
    setDraft(next);
    if (commit === "with-form") {
      onCommit(next);
    }
  }

  function confirm() {
    if (parsed.ok) {
      onCommit(draft);
    }
  }

  const field = (
    <TextInput
      style={{ flex: 1 }}
      value={draft}
      onChange={(e) => handleChange(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          confirm();
        } else if (e.key === "Escape") {
          setDraft(value);
        }
      }}
      placeholder={inheritedScheme || DEFAULT_PAYOUT_SCHEME}
      error={!parsed.ok}
      enterKeyHint="done"
    />
  );

  return (
    <div className={styles.payoutScheme}>
      {commit === "on-confirm" ? (
        <Group gap="xs" wrap="nowrap">
          {field}
          <Button
            variant={unsent ? "filled" : "default"}
            disabled={!unsent || !parsed.ok}
            onClick={confirm}
          >
            Apply
          </Button>
        </Group>
      ) : (
        field
      )}
      {parsed.ok ? (
        <>
          <div className={styles.previewHeader}>
            {playerCount === undefined ? (
              <Button.Group>
                <Button
                  size="compact-sm"
                  variant="default"
                  aria-label="fewer players"
                  disabled={previewCount <= 2}
                  onClick={() => setPreviewCount((c) => Math.max(2, c - 1))}
                >
                  <IconMinus size={14} />
                </Button>
                <Button size="compact-sm" variant="default" disabled>
                  {count} players
                </Button>
                <Button
                  size="compact-sm"
                  variant="default"
                  aria-label="more players"
                  disabled={previewCount >= 16}
                  onClick={() => setPreviewCount((c) => Math.min(16, c + 1))}
                >
                  <IconPlus size={14} />
                </Button>
              </Button.Group>
            ) : (
              <span className={styles.previewCount}>
                with {count} {count === 1 ? "player" : "players"}
              </span>
            )}
          </div>
          <div className={styles.payouts}>
            {Array.from({ length: count }, (_, index) => (
              <Badge
                key={index}
                variant="light"
                color={index === 0 && table[0] ? "blue" : "gray"}
                tt="none"
              >
                {ordinalPlace(index + 1)} <strong>{table[index] ?? 0}</strong>
              </Badge>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.error}>{parsed.error}</div>
      )}
      {unsent ? (
        <div className={styles.unsent}>
          {parsed.ok
            ? "applies to the next draw taken, not the ones already on the board"
            : "fix the payout before applying it"}
        </div>
      ) : (
        !draft.trim() && (
          <div className={styles.inherited}>
            using {inheritedScheme ? "the event's" : "the default"} {effective}
          </div>
        )
      )}
    </div>
  );
}

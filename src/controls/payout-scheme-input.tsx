import {
  Button,
  ButtonGroup,
  ControlGroup,
  InputGroup,
  Tag,
} from "@blueprintjs/core";
import { Minus, Plus } from "@blueprintjs/icons";
import { useState } from "react";
import {
  DEFAULT_PAYOUT_SCHEME,
  evaluatePayoutScheme,
  ordinalPlace,
  parsePayoutScheme,
} from "../models/payout-scheme";
import styles from "./payout-scheme-input.css";

interface Props {
  /** the scheme in use, empty to fall back to the built-in default */
  value: string;
  /** called on Apply or Enter, never per keystroke */
  onCommit: (next: string) => void;
  /**
   * Size of the heat to preview a payout for. Leave it off where nothing has
   * settled that yet and the preview grows a stepper of its own.
   */
  playerCount?: number;
}

/**
 * Editor for the event's gauntlet payout scheme, with the table it works out to
 * sitting right under it. The notation earns its keep by covering a heat of any
 * size, which also means nobody can read a payout straight off the text -- so
 * the preview isn't decoration here, it's how the field is checked.
 *
 * The preview follows every keystroke, but an edit isn't committed until it's
 * confirmed: everyone in the room shares this setting, and half a scheme is not
 * something to score a round on.
 */
export function PayoutSchemeInput({ value, onCommit, playerCount }: Props) {
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
  const effective = draft.trim() || DEFAULT_PAYOUT_SCHEME;
  const parsed = parsePayoutScheme(effective);
  const table = parsed.ok ? evaluatePayoutScheme(parsed.scheme, count) : [];
  const unsent = draft !== value;

  function confirm() {
    if (parsed.ok) {
      onCommit(draft);
    }
  }

  return (
    <div className={styles.payoutScheme}>
      <ControlGroup fill>
        <InputGroup
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              confirm();
            } else if (e.key === "Escape") {
              setDraft(value);
            }
          }}
          placeholder={DEFAULT_PAYOUT_SCHEME}
          intent={parsed.ok ? "none" : "danger"}
          enterKeyHint="done"
          fill
        />
        <Button
          intent={unsent ? "primary" : "none"}
          disabled={!unsent || !parsed.ok}
          onClick={confirm}
          text="Apply"
        />
      </ControlGroup>
      {parsed.ok ? (
        <>
          <div className={styles.previewHeader}>
            {playerCount === undefined ? (
              <ButtonGroup size="small">
                <Button
                  icon={<Minus />}
                  disabled={previewCount <= 2}
                  onClick={() => setPreviewCount((c) => Math.max(2, c - 1))}
                />
                <Button disabled text={`${count} players`} />
                <Button
                  icon={<Plus />}
                  disabled={previewCount >= 16}
                  onClick={() => setPreviewCount((c) => Math.min(16, c + 1))}
                />
              </ButtonGroup>
            ) : (
              <span className={styles.previewCount}>
                with {count} {count === 1 ? "player" : "players"}
              </span>
            )}
          </div>
          <div className={styles.payouts}>
            {Array.from({ length: count }, (_, index) => (
              <Tag
                key={index}
                minimal
                intent={index === 0 && table[0] ? "primary" : "none"}
              >
                {ordinalPlace(index + 1)} <strong>{table[index] ?? 0}</strong>
              </Tag>
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
          <div className={styles.inherited}>using the default {effective}</div>
        )
      )}
    </div>
  );
}

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
  /** the scheme as committed, empty when the draw or room inherits one */
  value: string;
  onCommit: (next: string) => void;
  /**
   * When a keystroke counts as an edit. A form's own submit button is
   * confirmation enough for the draw dialog, where nothing leaves React state
   * until it's pressed. Settings have no submit of their own and every commit
   * is an action the whole room sees, so those keep a draft until it's
   * confirmed rather than dispatching a scheme per keystroke.
   */
  commit: "with-form" | "on-confirm";
  /**
   * Size of the heat the preview pays out. Where that's already settled -- a
   * draw's own player list -- pass it and the preview follows it; leave it off
   * and the preview grows a stepper of its own.
   */
  playerCount?: number;
  /** what an empty field falls back to, spelled out under the preview */
  inheritedScheme?: string;
  placeholder?: string;
}

/**
 * Editor for a gauntlet payout scheme, with the table it works out to sitting
 * right under it. The notation earns its keep by covering a heat of any size,
 * which also means nobody can read a payout straight off the text -- so the
 * preview isn't decoration here, it's how the field is checked. It follows
 * what's being typed either way; what `commit` decides is when that typing
 * becomes an edit everyone else sees.
 */
export function PayoutSchemeInput({
  value,
  onCommit,
  commit,
  playerCount,
  inheritedScheme,
  placeholder,
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
    <InputGroup
      value={draft}
      onChange={(e) => handleChange(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          confirm();
        } else if (e.key === "Escape") {
          setDraft(value);
        }
      }}
      placeholder={placeholder || DEFAULT_PAYOUT_SCHEME}
      intent={parsed.ok ? "none" : "danger"}
      enterKeyHint="done"
      fill
    />
  );

  return (
    <div className={styles.payoutScheme}>
      {commit === "on-confirm" ? (
        <ControlGroup fill>
          {field}
          <Button
            intent={unsent ? "primary" : "none"}
            disabled={!unsent || !parsed.ok}
            onClick={confirm}
            text="Apply"
          />
        </ControlGroup>
      ) : (
        field
      )}
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
            ? "not in use yet — apply to pay it out this way"
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

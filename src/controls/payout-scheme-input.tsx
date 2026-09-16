import { Button, ButtonGroup, InputGroup, Tag } from "@blueprintjs/core";
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
  /** the scheme as typed, empty when the draw or room inherits one */
  value: string;
  onChange: (next: string) => void;
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
 * preview isn't decoration here, it's how the field is checked.
 */
export function PayoutSchemeInput({
  value,
  onChange,
  playerCount,
  inheritedScheme,
  placeholder,
}: Props) {
  // only used when the caller has no player count of its own to preview
  const [previewCount, setPreviewCount] = useState(4);
  const count = playerCount ?? previewCount;
  const effective = value.trim() || inheritedScheme || DEFAULT_PAYOUT_SCHEME;
  const parsed = parsePayoutScheme(effective);
  const table = parsed.ok ? evaluatePayoutScheme(parsed.scheme, count) : [];

  return (
    <div className={styles.payoutScheme}>
      <InputGroup
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder || DEFAULT_PAYOUT_SCHEME}
        intent={parsed.ok ? "none" : "danger"}
        fill
      />
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
      {!value.trim() && (
        <div className={styles.inherited}>
          using {inheritedScheme ? "the event's" : "the default"} {effective}
        </div>
      )}
    </div>
  );
}

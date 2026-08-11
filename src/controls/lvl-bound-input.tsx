import { InputGroup } from "@blueprintjs/core";
import { useState } from "react";
import { LvlBand, formatLvl, parseLvl, stepLvl } from "../lvl-display";

interface Props {
  bands: ReadonlyArray<LvlBand>;
  value: number;
  /** which end of the band a resolved lvl should snap to */
  edge: "low" | "high";
  onChange(this: void, value: number): void;
  intent?: "danger" | "warning";
  "aria-label"?: string;
}

/**
 * Text entry for a single lvl bound, in the game's own notation.
 *
 * On games with plus-suffixed lvls, "13+" is a span of internal values rather
 * than one number, so which end of that span a bound resolves to depends on
 * whether it opens or closes a range: a bucket from "13" to "13+" has to cover
 * 13.0 through 13.9 to mean what a player expects.
 */
export function LvlBoundInput({
  bands,
  value,
  edge,
  onChange,
  intent,
  "aria-label": ariaLabel,
}: Props) {
  // empty while clean, populated once the text diverges from the committed value
  const [draft, setDraft] = useState("");
  const committed = formatLvl(bands, value);
  const display = draft || committed;
  const parsed = draft ? parseLvl(bands, draft) : undefined;
  const draftIsValid = !draft || !!parsed;

  function commit(band: LvlBand | undefined) {
    setDraft("");
    if (band) {
      onChange(band[edge]);
    }
  }

  return (
    <InputGroup
      value={display}
      inputMode="decimal"
      intent={draftIsValid ? intent : "danger"}
      aria-label={ariaLabel}
      onValueChange={setDraft}
      onBlur={() => commit(parsed)}
      onKeyDown={(e) => {
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            commit(parsed);
            break;
          case "Escape":
            // the settings drawer closes on Escape, so keep a cancelled edit
            // from taking the whole drawer with it
            e.preventDefault();
            e.stopPropagation();
            setDraft("");
            break;
          case "ArrowUp":
            e.preventDefault();
            commit(stepLvl(bands, parsed ? parsed.low : value, 1));
            break;
          case "ArrowDown":
            e.preventDefault();
            commit(stepLvl(bands, parsed ? parsed.low : value, -1));
            break;
        }
      }}
    />
  );
}

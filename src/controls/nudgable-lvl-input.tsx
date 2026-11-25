import { Button, ControlGroup, InputGroup } from "@blueprintjs/core";
import { CaretLeft, CaretRight } from "@blueprintjs/icons";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  /** the lvl one step down, or undefined when there's nowhere lower to go */
  prevValue: number | undefined;
  /** the lvl one step up, or undefined when there's nowhere higher to go */
  nextValue: number | undefined;
  /** false when `value` isn't a lvl this game offers */
  isValid: boolean;
  onChange: (this: void, valueAsNumber: number) => void;
  size?: "small" | "large";
  inputSize?: number;
  "aria-label"?: string;
}

/**
 * A lvl entry field flanked by buttons that walk it through the lvls a game
 * actually has. Typing is free-form, but only a value the parent recognizes
 * gets committed — anything else shows as invalid until it's fixed or the
 * field is blurred.
 */
export function NudgableLvlInput({
  value,
  prevValue,
  nextValue,
  isValid,
  onChange,
  size,
  inputSize,
  "aria-label": ariaLabel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // localValue is empty string when input is clean
  // but picks up non-empty value when dirty (out of sync with root state)
  const [localValue, setLocalValue] = useState(value.toString());
  const displayValue = localValue || value.toString();
  let localValid = isValid;
  // collapse back to clean state when possible
  if (localValue === value.toString()) {
    setLocalValue("");
  } else if (localValue) {
    localValid = false;
  }

  const setInvalidMessage = useCallback((invalidMessage: string) => {
    if (!inputRef.current) return;
    inputRef.current.setCustomValidity(invalidMessage);
    inputRef.current.reportValidity();
  }, []);
  // always used with pre-validated values
  const stepTo = useCallback(
    (next: number | undefined) => {
      if (next === undefined) return;
      onChange(next);
      setLocalValue("");
    },
    [onChange],
  );
  const setNewValue = useCallback(
    (next: string) => {
      setLocalValue(next);
      const parsedValue = parseFloat(next);
      if (isNaN(parsedValue)) {
        setInvalidMessage("Must be a number");
        return;
      }
      // only pass fully validated number values to parent
      onChange(parsedValue);
    },
    [setInvalidMessage, onChange],
  );

  useEffect(() => {
    if (!isValid) {
      setInvalidMessage("Not a valid lvl");
    }
  }, [isValid, setInvalidMessage]);

  return (
    <ControlGroup>
      <Button
        icon={<CaretLeft />}
        size={size}
        disabled={prevValue === undefined}
        aria-label={ariaLabel && `${ariaLabel} down`}
        onClick={() => stepTo(prevValue)}
      />
      <InputGroup
        inputRef={inputRef}
        value={displayValue}
        intent={localValid ? undefined : "danger"}
        size={size}
        inputSize={inputSize}
        inputMode="numeric"
        aria-label={ariaLabel}
        onChange={(e) => setNewValue(e.currentTarget.value)}
        onBlur={() => setLocalValue("")}
        onKeyDown={(e) => {
          switch (e.key) {
            case "ArrowUp":
              e.preventDefault();
              stepTo(nextValue);
              break;
            case "ArrowDown":
              e.preventDefault();
              stepTo(prevValue);
              break;
          }
        }}
      />
      <Button
        icon={<CaretRight />}
        size={size}
        disabled={nextValue === undefined}
        aria-label={ariaLabel && `${ariaLabel} up`}
        onClick={() => stepTo(nextValue)}
      />
    </ControlGroup>
  );
}

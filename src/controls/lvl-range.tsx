import { Button, ControlGroup, FormGroup, InputGroup } from "@blueprintjs/core";
import { CaretLeft, CaretRight } from "@blueprintjs/icons";
import { getAvailableLevels } from "../game-data-utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "../hooks/useIntl";
import styles from "./controls.css";
import { useConfigState, useUpdateConfig } from "../state/hooks";
import { useStockGameData } from "../state/game-data.atoms";

function getBounds(
  lowerIdx: number,
  upperIdx: number,
  availableLvls: number[],
) {
  const lowerPrevIdx = lowerIdx - 1;
  const lowerNextIdx = lowerIdx + 1;
  const upperPrevIdx = upperIdx - 1;
  const upperNextIdx = upperIdx + 1;

  const lowerPrev = lowerPrevIdx >= 0 ? availableLvls[lowerPrevIdx] : undefined;
  const upperNext =
    upperNextIdx < availableLvls.length
      ? availableLvls[upperNextIdx]
      : undefined;

  let lowerNext: number | undefined;
  let upperPrev: number | undefined;

  // make sure we're not using the same value for upper/lower
  if (lowerIdx !== upperIdx) {
    lowerNext = availableLvls[lowerNextIdx];
    upperPrev = availableLvls[upperPrevIdx];
  }

  return {
    lowerPrev,
    lowerNext,
    upperPrev,
    upperNext,
  };
}

export function LvlRangeControls() {
  const { t } = useIntl();
  const updateState = useUpdateConfig();
  const lowerBound = useConfigState((s) => s.lowerBound);
  const upperBound = useConfigState((s) => s.upperBound);
  const useGranularLevels = useConfigState((s) => s.useGranularLevels);
  const gameKey = useConfigState((s) => s.gameKey);
  const gameData = useStockGameData(gameKey);
  const usesDrawGroups = !!gameData?.meta.usesDrawGroups;
  const availableLevels = useMemo(
    () => getAvailableLevels(gameData, useGranularLevels),
    [gameData, useGranularLevels],
  );

  /**
   * attempts to step to the next value of available levels for either bounds field
   */
  function setNextStateStep(
    stateKey: "upperBound" | "lowerBound",
    newValue: number,
  ) {
    updateState((prev) => {
      // re-calc with current state of granular levels. the one in scope above may be stale
      const availableLevels = getAvailableLevels(
        gameData,
        prev.useGranularLevels,
      );
      if (availableLevels.includes(newValue)) {
        return { [stateKey]: newValue };
      }
      return {};
    });
  }

  const handleLowerBoundChange = (newLow: number) => {
    if (newLow !== lowerBound) {
      if (newLow > upperBound) {
        newLow = upperBound;
      }
      setNextStateStep("lowerBound", newLow);
    }
  };

  const handleUpperBoundChange = (newHigh: number) => {
    if (newHigh !== upperBound) {
      if (newHigh < lowerBound) {
        newHigh = upperBound;
      }
      setNextStateStep("upperBound", newHigh);
    }
  };
  const lowerBoundIdx = availableLevels.indexOf(lowerBound);
  const upperBoundIdx = availableLevels.indexOf(upperBound);
  const { lowerPrev, lowerNext, upperPrev, upperNext } = getBounds(
    lowerBoundIdx,
    upperBoundIdx,
    availableLevels,
  );

  return (
    <>
      <NudgableRangeInput
        label={
          usesDrawGroups
            ? t("controls.lowerBoundTier")
            : t("controls.lowerBoundLvl")
        }
        value={lowerBound}
        onChange={handleLowerBoundChange}
        isValid={lowerBoundIdx !== -1}
        prevValue={lowerPrev}
        nextValue={lowerNext}
      />
      <NudgableRangeInput
        label={
          usesDrawGroups
            ? t("controls.upperBoundTier")
            : t("controls.upperBoundLvl")
        }
        value={upperBound}
        onChange={handleUpperBoundChange}
        isValid={upperBoundIdx !== -1}
        prevValue={upperPrev}
        nextValue={upperNext}
      />
    </>
  );
}

interface Props {
  label: string;
  value: number;
  onChange: (valueAsNumber: number) => void;
  isValid: boolean;
  prevValue: number | undefined;
  nextValue: number | undefined;
  // Force INT/Float format somehow?
}

function NudgableRangeInput({
  label,
  value,
  prevValue,
  nextValue,
  isValid,
  onChange,
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
      console.log({ next, parsedValue });
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
    <FormGroup label={label} contentClassName={styles.narrowInput}>
      <ControlGroup>
        <Button
          icon={<CaretLeft />}
          disabled={prevValue === undefined}
          onClick={() => stepTo(prevValue)}
        />
        <InputGroup
          inputRef={inputRef}
          value={displayValue}
          intent={localValid ? undefined : "danger"}
          size="large"
          inputSize={4}
          inputMode="numeric"
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
          disabled={nextValue === undefined}
          onClick={() => stepTo(nextValue)}
        />
      </ControlGroup>
    </FormGroup>
  );
}

import { Button, ControlGroup, FormGroup, InputGroup } from "@blueprintjs/core";
import { CaretLeft, CaretRight } from "@blueprintjs/icons";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "../hooks/useIntl";
import { useDrawState } from "../draw-state";
import { useConfigState } from "../config-state";
import { LvlBand, formatLvl, getLvlBands, parseLvl } from "../lvl-display";
import styles from "./controls.css";

function getNeighbors(lowerIdx: number, upperIdx: number, bands: LvlBand[]) {
  const lowerPrev = lowerIdx > 0 ? bands[lowerIdx - 1] : undefined;
  const upperNext =
    upperIdx >= 0 && upperIdx < bands.length - 1
      ? bands[upperIdx + 1]
      : undefined;

  let lowerNext: LvlBand | undefined;
  let upperPrev: LvlBand | undefined;

  // make sure we're not using the same value for upper/lower
  if (lowerIdx !== upperIdx) {
    lowerNext = bands[lowerIdx + 1];
    upperPrev = bands[upperIdx - 1];
  }

  return { lowerPrev, lowerNext, upperPrev, upperNext };
}

export function LvlRangeControls() {
  const { t } = useIntl();
  const gameData = useDrawState((s) => s.gameData);
  const usesDrawGroups = !!gameData?.meta.usesDrawGroups;
  const {
    lowerBound,
    upperBound,
    update: updateState,
    useGranularLevels,
  } = useConfigState();
  const bands = useMemo(
    () => getLvlBands(gameData, useGranularLevels),
    [gameData, useGranularLevels],
  );

  // a bound sits at one end of its band: the low bound opens its band and the
  // high bound closes it, so a 13 to 13+ range covers all of 13.0 through 13.9
  const lowerIdx = bands.findIndex((b) => b.low === lowerBound);
  const upperIdx = bands.findIndex((b) => b.high === upperBound);
  const { lowerPrev, lowerNext, upperPrev, upperNext } = getNeighbors(
    lowerIdx,
    upperIdx,
    bands,
  );

  const setLowerBound = useCallback(
    (band: LvlBand) => {
      updateState((prev) => ({
        lowerBound: Math.min(band.low, prev.upperBound),
      }));
    },
    [updateState],
  );
  const setUpperBound = useCallback(
    (band: LvlBand) => {
      updateState((prev) => ({
        upperBound: Math.max(band.high, prev.lowerBound),
      }));
    },
    [updateState],
  );

  return (
    <>
      <NudgableRangeInput
        label={
          usesDrawGroups
            ? t("controls.lowerBoundTier")
            : t("controls.lowerBoundLvl")
        }
        bands={bands}
        value={lowerBound}
        onChange={setLowerBound}
        isValid={lowerIdx !== -1}
        prevValue={lowerPrev}
        nextValue={lowerNext}
      />
      <NudgableRangeInput
        label={
          usesDrawGroups
            ? t("controls.upperBoundTier")
            : t("controls.upperBoundLvl")
        }
        bands={bands}
        value={upperBound}
        onChange={setUpperBound}
        isValid={upperIdx !== -1}
        prevValue={upperPrev}
        nextValue={upperNext}
      />
    </>
  );
}

interface Props {
  label: string;
  bands: LvlBand[];
  value: number;
  onChange: (band: LvlBand) => void;
  isValid: boolean;
  prevValue: LvlBand | undefined;
  nextValue: LvlBand | undefined;
}

function NudgableRangeInput({
  label,
  bands,
  value,
  prevValue,
  nextValue,
  isValid,
  onChange,
}: Props) {
  // localValue is empty string when input is clean
  // but picks up non-empty value when dirty (out of sync with root state)
  const [localValue, setLocalValue] = useState("");
  const committed = formatLvl(bands, value);
  const displayValue = localValue || committed;
  const parsed = localValue ? parseLvl(bands, localValue) : undefined;
  const localValid = localValue ? !!parsed : isValid;

  const commit = useCallback(
    (band: LvlBand | undefined) => {
      setLocalValue("");
      if (band) {
        onChange(band);
      }
    },
    [onChange],
  );

  return (
    <FormGroup label={label} contentClassName={styles.narrowInput}>
      <ControlGroup>
        <Button
          icon={<CaretLeft />}
          disabled={prevValue === undefined}
          onClick={() => commit(prevValue)}
        />
        <InputGroup
          value={displayValue}
          intent={localValid ? undefined : "danger"}
          size="large"
          inputSize={4}
          inputMode="decimal"
          onValueChange={setLocalValue}
          onBlur={() => commit(parsed)}
          onKeyDown={(e) => {
            switch (e.key) {
              case "Enter":
                e.preventDefault();
                commit(parsed);
                break;
              case "Escape":
                // the settings drawer closes on Escape, so keep a cancelled
                // edit from taking the whole drawer with it
                e.preventDefault();
                e.stopPropagation();
                setLocalValue("");
                break;
              case "ArrowUp":
                e.preventDefault();
                commit(nextValue);
                break;
              case "ArrowDown":
                e.preventDefault();
                commit(prevValue);
                break;
            }
          }}
        />
        <Button
          icon={<CaretRight />}
          disabled={nextValue === undefined}
          onClick={() => commit(nextValue)}
        />
      </ControlGroup>
    </FormGroup>
  );
}

import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  ProgressBar,
} from "@blueprintjs/core";
import { draw } from "../card-draw";
import { useDrawState } from "../draw-state";
import { useAtom } from "jotai";
import { useConfigState } from "../config-state";
import { requestIdleCallback } from "../utils/idle-callback";
import {
  TEST_SIZE,
  REPORT_FREQUENCY,
  degrsIsTesting,
  degrsTestProgress,
  degrsTestResults,
} from "./degrs-state";
import { SongCard, SongCardProps } from "../song-card";
import { useState } from "react";
import { Rain, Repeat, WarningSign } from "@blueprintjs/icons";
import { EligibleChart, PlayerPickPlaceholder } from "../models/Drawing";

export function isDegrs(thing: EligibleChart | PlayerPickPlaceholder) {
  return "name" in thing && thing.name.startsWith('DEAD END("GROOVE');
}

function* oneMillionDraws() {
  const gameData = useDrawState.getState().gameData!;
  const configState = useConfigState.getState();

  for (let idx = 0; idx < TEST_SIZE; idx++) {
    yield [draw(gameData, configState), idx] as const;
  }
}

/**
 * Returns percentage of 100k draws that contained degrs
 * yields current progress every 1000 loops to allow passing back
 * the event loop
 **/
export function* degrsTester() {
  let totalDegrs = 0;
  for (const [set, idx] of oneMillionDraws()) {
    if (set.charts.some(isDegrs)) {
      totalDegrs++;
    }
    if (idx % REPORT_FREQUENCY === 0) {
      yield idx / TEST_SIZE;
    }
  }
  return totalDegrs / TEST_SIZE;
}

function nextIdleCycle() {
  return new Promise<void>((resolve) => {
    requestIdleCallback(resolve);
  });
}

export function DegrsTestButton() {
  const [isTesting, setIsTesting] = useAtom(degrsIsTesting);
  const [progress, setProgress] = useAtom(degrsTestProgress);
  const [results, setResults] = useAtom(degrsTestResults);

  async function startTest() {
    setIsTesting(true);
    setProgress(0);
    setResults(undefined);
    await nextIdleCycle();
    const tester = degrsTester();
    let report = tester.next();
    while (!report.done) {
      setProgress(report.value);
      await nextIdleCycle();
      report = tester.next();
    }
    setIsTesting(false);
    setProgress(100);
    setResults(report.value);
  }

  const hasResults = typeof results === "number";

  return (
    <>
      {!isTesting && (
        <Button
          onClick={startTest}
          intent="danger"
          icon={hasResults ? <Repeat /> : <WarningSign />}
        >
          {hasResults ? "Recompute" : "Compute"} DEGRS Forecast
        </Button>
      )}
      {isTesting && (
        <p>
          Calculating DEGRS ratio...{" "}
          <ProgressBar value={progress} intent="danger" />
        </p>
      )}
      {hasResults && (
        <Callout icon={<Rain />}>
          Today's risk of DEGRS is {(results * 100).toFixed(1)}%
        </Callout>
      )}
    </>
  );
}

export function TesterCard(props: SongCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="DEGRS Emergency Response System"
        icon={<WarningSign />}
      >
        <DialogBody>
          <DegrsTestButton />
        </DialogBody>
      </Dialog>
      <SongCard {...props} onClick={() => setIsOpen(true)} />
    </>
  );
}

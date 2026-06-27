import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  FormGroup,
  ProgressBar,
} from "@blueprintjs/core";
import { draw } from "../card-draw";
import { useAtom } from "jotai";
import { configSlice } from "../state/config.slice";
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
import { useAppStore, type StoreType } from "../state/store";
import { GameData } from "../models/SongData";
import { useGameData } from "../state/hooks";
import { ConfigSelect } from ".";

export function isDegrs(thing: EligibleChart | PlayerPickPlaceholder) {
  return "name" in thing && thing.name.startsWith('DEAD END("GROOVE');
}

function* oneMillionDraws(
  store: StoreType,
  gameData: GameData,
  configId: string,
) {
  const configState = configSlice.selectors.selectById(
    store.getState(),
    configId,
  );

  for (let idx = 0; idx < TEST_SIZE; idx++) {
    yield [
      draw(gameData, configState!, {
        meta: { players: [], title: "", type: "simple" },
      }),
      idx,
    ] as const;
  }
}

/**
 * Returns percentage of 100k draws that contained degrs
 * yields current progress every 1000 loops to allow passing back
 * the event loop
 **/
export function* degrsTester(
  store: StoreType,
  gameData: GameData,
  configId: string,
) {
  let totalDegrs = 0;
  for (const [charts, idx] of oneMillionDraws(store, gameData, configId)) {
    if (charts.some(isDegrs)) {
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

export function DegrsTestButton(props: { configId: string | null }) {
  const [isTesting, setIsTesting] = useAtom(degrsIsTesting);
  const [progress, setProgress] = useAtom(degrsTestProgress);
  const [results, setResults] = useAtom(degrsTestResults);
  const gameData = useGameData();
  const store = useAppStore();

  async function startTest() {
    setIsTesting(true);
    setProgress(0);
    setResults(undefined);
    await nextIdleCycle();
    const tester = degrsTester(store, gameData!, props.configId!);
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
          disabled={!props.configId}
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
  const [configId, setConfigId] = useState<string | null>(null);
  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="DEGRS Emergency Response System"
        icon={<WarningSign />}
      >
        <DialogBody>
          <FormGroup>
            <ConfigSelect selectedId={configId} onChange={setConfigId} />
          </FormGroup>
          <DegrsTestButton configId={configId} />
        </DialogBody>
      </Dialog>
      <SongCard {...props} onClick={() => setIsOpen(true)} />
    </>
  );
}

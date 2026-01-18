import {
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Classes,
  Collapse,
  Divider,
  FormGroup,
  HTMLSelect,
  Icon,
  NumericInput,
  Tab,
  Tabs,
} from "@blueprintjs/core";
import {
  ThirdParty,
  GlobeNetwork,
  Settings,
  People,
  CaretDown,
  CaretRight,
  Plus,
  SmallTick,
  SmallCross,
} from "@blueprintjs/icons";
import { useMemo, useState, lazy } from "react";
import { shallow } from "zustand/shallow";
import { useConfigState } from "../config-state";
import { useDrawState } from "../draw-state";
import { EligibleChartsListFilter } from "../eligible-charts/filter";
import { useIntl } from "../hooks/useIntl";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { GameData } from "../models/SongData";
import { RemotePeerControls } from "../tournament-mode/remote-peer-menu";
import { useRemotePeers } from "../tournament-mode/remote-peers";
import { WeightsControls } from "./controls-weights";
import styles from "./controls.css";
import { PlayerNamesControls } from "./player-names";
import { getAvailableLevels } from "../game-data-utils";
import { ShowChartsToggle } from "./show-charts-toggle";
import { Fraction } from "../utils/fraction";

const ReleaseDateFilterControl = lazy(() => import("./release-date-filter"));
function ReleaseDateFilter() {
  const gameData = useDrawState((s) => s.gameData);
  const mostRecentRelease = useMemo(
    () =>
      gameData?.songs.reduce<string>((prev, song) => {
        if (song.date_added && song.date_added > prev) return song.date_added;
        return prev;
      }, ""),
    [gameData],
  );

  if (!mostRecentRelease) {
    return null;
  }
  return <ReleaseDateFilterControl mostRecentRelease={mostRecentRelease} />;
}

function getAvailableDifficulties(gameData: GameData, selectedStyle: string) {
  const s = new Set<string>();
  for (const f of gameData.songs) {
    for (const c of f.charts) {
      if (c.style === selectedStyle) {
        s.add(c.diffClass);
      }
    }
  }
  return gameData.meta.difficulties.filter((d) => s.has(d.key));
}

function getDiffsAndRangeForNewStyle(
  gameData: GameData,
  selectedStyle: string,
) {
  const s = new Set<string>();
  const range = { high: 0, low: 100 };
  for (const f of gameData.songs) {
    for (const c of f.charts) {
      if (c.style === selectedStyle) {
        s.add(c.diffClass);
        if (c.lvl > range.high) {
          range.high = c.lvl;
        }
        if (c.lvl < range.low) {
          range.low = c.lvl;
        }
      }
    }
  }
  return {
    diffs: gameData.meta.difficulties.filter((d) => s.has(d.key)),
    lvlRange: range,
  };
}

export default function ControlsDrawer() {
  const { t } = useIntl();
  const isConnected = useRemotePeers((r) => !!r.thisPeer);
  const hasPeers = useRemotePeers((r) => !!r.remotePeers.size);
  return (
    <div className={styles.drawer}>
      <Tabs id="settings" size="large">
        <Tab
          id="general"
          icon={<Settings className={Classes.TAB_ICON} />}
          panel={<GeneralSettings />}
        >
          {t("controls.tabs.general")}
        </Tab>
        <Tab
          id="network"
          icon={
            <Icon
              icon={
                hasPeers ? (
                  <ThirdParty className={Classes.TAB_ICON} />
                ) : (
                  <GlobeNetwork className={Classes.TAB_ICON} />
                )
              }
              intent={isConnected ? "success" : "none"}
            />
          }
          panel={<RemotePeerControls />}
        >
          {t("controls.tabs.networking")}
        </Tab>
        <Tab
          id="players"
          icon={<People className={Classes.TAB_ICON} />}
          panel={<PlayerNamesControls />}
        >
          {t("controls.tabs.players")}
        </Tab>
      </Tabs>
    </div>
  );
}

/** Renders the checkboxes for each individual flag that exists in the data file's meta.flags */
function FlagSettings() {
  const { t } = useIntl();
  const [dataSetName, gameData, hasFlags] = useDrawState(
    (s) => [s.dataSetName, s.gameData, !!s.gameData?.meta.flags.length],
    shallow,
  );
  const [updateState, selectedFlags] = useConfigState(
    (s) => [s.update, s.flags],
    shallow,
  );

  if (!hasFlags) {
    return false;
  }

  return (
    <FormGroup label={t("controls.include")}>
      {gameData?.meta.flags.map((key) => (
        <Checkbox
          key={`${dataSetName}:${key}`}
          label={t("meta." + key)}
          value={key}
          checked={selectedFlags.has(key)}
          onChange={() =>
            updateState((s) => {
              const newFlags = new Set(s.flags);
              if (newFlags.has(key)) {
                newFlags.delete(key);
              } else {
                newFlags.add(key);
              }
              return { flags: newFlags };
            })
          }
        />
      ))}
    </FormGroup>
  );
}

/** Renders the checkboxes for each individual folder that exists in the data file's meta.folders */
function FolderSettings() {
  const { t } = useIntl();
  const availableFolders = useDrawState((s) => s.gameData?.meta.folders);
  const dataSetName = useDrawState((s) => s.dataSetName);
  const [updateState, selectedFolders] = useConfigState(
    (s) => [s.update, s.folders],
    shallow,
  );

  if (!availableFolders?.length) {
    return null;
  }

  return (
    <FormGroup
      label={t("controls.folders")}
      style={{ opacity: selectedFolders.size ? undefined : 0.8 }}
    >
      <ButtonGroup className={styles.smallText}>
        <Button
          small
          icon={<SmallTick />}
          onClick={() => updateState({ folders: new Set(availableFolders) })}
        >
          All
        </Button>
        <Button
          small
          icon={<SmallCross />}
          onClick={() => updateState({ folders: new Set() })}
        >
          Ignore Folders
        </Button>
      </ButtonGroup>
      {availableFolders.map((folder, idx) => (
        <Checkbox
          key={`${dataSetName}:${idx}`}
          label={folder}
          value={folder}
          checked={selectedFolders.has(folder)}
          onChange={() =>
            updateState((s) => {
              const newFolders = new Set(s.folders);
              if (newFolders.has(folder)) {
                newFolders.delete(folder);
              } else {
                newFolders.add(folder);
              }
              return { folders: newFolders };
            })
          }
        />
      ))}
    </FormGroup>
  );
}

function GeneralSettings() {
  const { t } = useIntl();
  const gameData = useDrawState((s) => s.gameData);
  const configState = useConfigState();
  const {
    useWeights,
    constrainPocketPicks,
    orderByAction,
    hideVetos,
    lowerBound,
    upperBound,
    update: updateState,
    difficulties: selectedDifficulties,
    style: selectedStyle,
    chartCount,
    sortByLevel,
    useGranularLevels,
    playerPicks,
  } = configState;
  const availableDifficulties = useMemo(() => {
    if (!gameData) {
      return [];
    }
    return getAvailableDifficulties(gameData, selectedStyle);
  }, [gameData, selectedStyle]);
  const isNarrow = useIsNarrow();
  const [expandFilters, setExpandFilters] = useState(false);
  const availableLevels = useMemo(
    () => getAvailableLevels(gameData, useGranularLevels),
    [gameData, useGranularLevels],
  );

  if (!gameData) {
    return null;
  }
  const granularIncrement = new Fraction(
    1,
    gameData.meta.granularTierResolution || 1,
  );
  const { styles: gameStyles } = gameData.meta;

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
      const currentValue = configState[stateKey];
      const currentIndex = availableLevels.indexOf(currentValue);
      const direction = newValue > currentValue ? 1 : -1;
      const newIndex = currentIndex + direction;
      if (newIndex < 0 || newIndex >= availableLevels.length) {
        console.error("cannot go outside of available levels");
        return {};
      }
      return { [stateKey]: availableLevels[newIndex] };
    });
  }

  const handleLowerBoundChange = (
    newLow: number,
    newLowRaw: string,
    element: HTMLInputElement,
  ) => {
    if (newLow !== lowerBound && !isNaN(newLow)) {
      if (newLow > upperBound) {
        newLow = upperBound;
      }
      setNextStateStep("lowerBound", newLow);
    } else if (useGranularLevels) {
      element.value = newLow.toFixed(2);
    }
  };

  const handleUpperBoundChange = (
    newHigh: number,
    newHighRaw: string,
    element: HTMLInputElement,
  ) => {
    if (newHigh !== upperBound && !isNaN(newHigh)) {
      setNextStateStep("upperBound", newHigh);
    } else if (useGranularLevels) {
      element.value = newHigh.toFixed(2);
    }
  };
  const usesDrawGroups = !!gameData?.meta.usesDrawGroups;

  return (
    <>
      {isNarrow && (
        <>
          <FormGroup>
            <ShowChartsToggle inDrawer />
          </FormGroup>
          <Collapse
            isOpen={!!configState.flags.size && configState.showEligibleCharts}
          >
            <FormGroup label="Show only">
              <EligibleChartsListFilter />
            </FormGroup>
          </Collapse>
          <Divider />
        </>
      )}
      <div className={styles.inlineControls}>
        <FormGroup
          label={t("controls.chartCount")}
          contentClassName={styles.narrowInput}
        >
          <NumericInput
            size="large"
            fill
            type="number"
            inputMode="numeric"
            value={chartCount}
            min={playerPicks ? 0 : 1}
            clampValueOnBlur
            onValueChange={(chartCount) => {
              if (!isNaN(chartCount)) {
                updateState(() => {
                  return { chartCount };
                });
              }
            }}
          />
        </FormGroup>
        <Plus className={styles.plus} size={20} />
        <FormGroup
          label={t("controls.playerPicks")}
          contentClassName={styles.narrowInput}
        >
          <NumericInput
            size="large"
            fill
            type="number"
            inputMode="numeric"
            value={playerPicks}
            min={chartCount ? 0 : 1}
            clampValueOnBlur
            onValueChange={(playerPicks) => {
              if (!isNaN(playerPicks)) {
                updateState(() => {
                  return { playerPicks };
                });
              }
            }}
          />
        </FormGroup>
      </div>
      <div className={styles.inlineControls}>
        <FormGroup
          label={
            usesDrawGroups
              ? t("controls.lowerBoundTier")
              : t("controls.lowerBoundLvl")
          }
          contentClassName={styles.narrowInput}
        >
          <NumericInput
            size="large"
            fill
            type="number"
            inputMode="numeric"
            value={useGranularLevels ? lowerBound.toFixed(2) : lowerBound}
            min={availableLevels[0]}
            max={Math.max(upperBound, lowerBound, 1)}
            stepSize={useGranularLevels ? granularIncrement.valueOf() : 1}
            majorStepSize={useGranularLevels ? 1.0 : null}
            minorStepSize={
              useGranularLevels ? granularIncrement.valueOf() : null
            }
            onValueChange={handleLowerBoundChange}
          />
        </FormGroup>
        <FormGroup
          label={
            usesDrawGroups
              ? t("controls.upperBoundTier")
              : t("controls.upperBoundLvl")
          }
          contentClassName={styles.narrowInput}
        >
          <NumericInput
            size="large"
            fill
            type="number"
            inputMode="numeric"
            value={useGranularLevels ? upperBound.toFixed(2) : upperBound}
            min={lowerBound}
            max={availableLevels[availableLevels.length - 1]}
            stepSize={useGranularLevels ? granularIncrement.valueOf() : 1}
            majorStepSize={useGranularLevels ? 1.0 : null}
            minorStepSize={
              useGranularLevels ? granularIncrement.valueOf() : null
            }
            onValueChange={handleUpperBoundChange}
          />
        </FormGroup>
      </div>
      <Button
        alignText="left"
        rightIcon={expandFilters ? <CaretDown /> : <CaretRight />}
        onClick={() => setExpandFilters((p) => !p)}
      >
        {t("controls.hideShowFilters")}
      </Button>
      <Collapse isOpen={expandFilters}>
        <Card style={{ paddingBottom: "1px" }}>
          {gameStyles.length > 1 && (
            <FormGroup labelFor="style" label={t("controls.style")}>
              <HTMLSelect
                id="style"
                large
                value={selectedStyle}
                onChange={(e) => {
                  updateState((prev) => {
                    const next = { ...prev, style: e.currentTarget.value };
                    const { diffs, lvlRange } = getDiffsAndRangeForNewStyle(
                      gameData,
                      next.style,
                    );
                    if (diffs.length === 1) {
                      next.difficulties = new Set(diffs.map((d) => d.key));
                    }
                    if (lvlRange.low > next.upperBound) {
                      next.upperBound = lvlRange.low;
                    }
                    if (lvlRange.high < next.lowerBound) {
                      next.lowerBound = lvlRange.high;
                    }
                    return next;
                  });
                }}
              >
                {gameStyles.map((style) => (
                  <option key={style} value={style}>
                    {t("meta." + style)}
                  </option>
                ))}
              </HTMLSelect>
            </FormGroup>
          )}
          <FormGroup label={t("controls.difficulties")}>
            {availableDifficulties.map((dif) => (
              <Checkbox
                key={`${dif.key}`}
                name="difficulties"
                value={dif.key}
                checked={selectedDifficulties.has(dif.key)}
                onChange={(e) => {
                  const { checked, value } = e.currentTarget;
                  updateState((s) => {
                    const difficulties = new Set(s.difficulties);
                    if (checked) {
                      difficulties.add(value);
                    } else {
                      difficulties.delete(value);
                    }
                    return { difficulties };
                  });
                }}
                label={t("meta." + dif.key)}
              />
            ))}
          </FormGroup>
          <ReleaseDateFilter />
          <FlagSettings />
          <FolderSettings />
        </Card>
      </Collapse>
      <FormGroup>
        <Checkbox
          id="orderByAction"
          checked={orderByAction}
          onChange={(e) => {
            const reorder = !!e.currentTarget.checked;
            updateState({ orderByAction: reorder });
          }}
          label={t("controls.orderByAction")}
        />
        <Checkbox
          id="constrainPocketPicks"
          checked={constrainPocketPicks}
          onChange={(e) => {
            const constrainPocketPicks = !!e.currentTarget.checked;
            updateState({ constrainPocketPicks });
          }}
          label={t("controls.constrainPocketPicks")}
        />
        <Checkbox
          id="sortByLevel"
          checked={sortByLevel}
          onChange={(e) => {
            const sortByLevel = !!e.currentTarget.checked;
            updateState({ sortByLevel });
          }}
          label={t("controls.sortByLevel")}
        />
        <Checkbox
          id="useGranularLevels"
          disabled={!gameData.meta.granularTierResolution}
          checked={useGranularLevels}
          onChange={(e) => {
            const useGranularLevels = !!e.currentTarget.checked;
            updateState((prev) => {
              let nextUpperBound = !useGranularLevels
                ? Math.floor(prev.upperBound)
                : new Fraction(prev.upperBound + 1)
                    .sub(granularIncrement)
                    .valueOf();
              if (nextUpperBound < prev.lowerBound) {
                nextUpperBound = prev.lowerBound + 1;
              }
              return { useGranularLevels, upperBound: nextUpperBound };
            });
          }}
          label={t("controls.useGranularLevels")}
        />
        <Checkbox
          id="showVeto"
          checked={hideVetos}
          onChange={(e) => {
            const next = !!e.currentTarget.checked;
            updateState({ hideVetos: next });
          }}
          label={t("controls.hideVetos")}
        />
        <Checkbox
          id="weighted"
          checked={useWeights}
          onChange={(e) => {
            const useWeights = !!e.currentTarget.checked;
            updateState({ useWeights });
          }}
          label={t("controls.useWeightedDistributions")}
        />
        <Collapse isOpen={useWeights}>
          <WeightsControls
            usesTiers={usesDrawGroups}
            high={upperBound}
            low={lowerBound}
          />
        </Collapse>
      </FormGroup>
    </>
  );
}

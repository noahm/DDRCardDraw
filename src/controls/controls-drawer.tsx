import {
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Collapse,
  FormGroup,
  HTMLSelect,
  NumericInput,
  SegmentedControl,
} from "@blueprintjs/core";
import {
  CaretDown,
  CaretRight,
  Plus,
  SmallTick,
  SmallCross,
} from "@blueprintjs/icons";
import { useMemo, useState, lazy } from "react";
import { useIntl } from "../hooks/useIntl";
import { GameData } from "../models/SongData";
import { WeightsControls } from "./controls-weights";
import { ManualBucketControls } from "./controls-buckets";
import {
  BucketMode,
  rescaleManualBuckets,
  seedManualBuckets,
} from "../draw-buckets";
import styles from "./controls.css";
import { useGetMetaString } from "../game-data-utils";
import { Fraction } from "../utils/fraction";
import {
  ConfigContextProvider,
  useConfigState,
  useGameData,
  useUpdateConfig,
} from "../state/hooks";
import { MultidrawControls } from "./multidraw-controls";
import { LvlRangeControls } from "./lvl-range";

const ReleaseDateFilterControl = lazy(() => import("./release-date-filter"));
function ReleaseDateFilter() {
  const gameData = useGameData();
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

export default function ControlsDrawer(props: { configId: string | null }) {
  if (!props.configId) {
    return null;
  }
  return (
    <div className={styles.drawer}>
      <ConfigContextProvider value={props.configId}>
        <GeneralSettings />
      </ConfigContextProvider>
    </div>
  );
}

/** Renders the checkboxes for each individual flag that exists in the data file's meta.flags */
function FlagSettings() {
  const { t } = useIntl();
  const gameData = useGameData();
  const hasFlags = !!gameData?.meta.flags.length;
  const updateState = useUpdateConfig();
  const selectedFlags = useConfigState((s) => s.flags);
  const getMetaString = useGetMetaString();

  if (!hasFlags || !gameData) {
    return false;
  }
  const dataSetName = gameData.i18n.en.name as string;

  return (
    <FormGroup label={t("controls.include")}>
      {gameData?.meta.flags.map((key) => (
        <Checkbox
          key={`${dataSetName}:${key}`}
          label={getMetaString(key)}
          value={key}
          checked={selectedFlags.includes(key)}
          onChange={() =>
            updateState((s) => {
              const newFlags = new Set(s.flags);
              if (newFlags.has(key)) {
                newFlags.delete(key);
              } else {
                newFlags.add(key);
              }
              return { flags: Array.from(newFlags) };
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
  const gameData = useGameData();
  const availableFolders = gameData?.meta.folders;
  const updateState = useUpdateConfig();
  const selectedFolders = useConfigState((s) => s.folders);

  if (!availableFolders?.length || !gameData) {
    return null;
  }
  const dataSetName = gameData?.i18n.en.name as string;

  return (
    <FormGroup
      label={t("controls.folders")}
      style={{ opacity: selectedFolders.length ? undefined : 0.8 }}
    >
      <ButtonGroup className={styles.smallText}>
        <Button
          small
          icon={<SmallTick />}
          onClick={() => updateState({ folders: availableFolders })}
        >
          All
        </Button>
        <Button
          small
          icon={<SmallCross />}
          onClick={() => updateState({ folders: [] })}
        >
          Ignore Folders
        </Button>
      </ButtonGroup>
      {availableFolders.map((folder, idx) => (
        <Checkbox
          key={`${dataSetName}:${idx}`}
          label={folder}
          value={folder}
          checked={selectedFolders.includes(folder)}
          onChange={() =>
            updateState((s) => {
              const newFolders = new Set(s.folders);
              if (newFolders.has(folder)) {
                newFolders.delete(folder);
              } else {
                newFolders.add(folder);
              }
              return { folders: Array.from(newFolders) };
            })
          }
        />
      ))}
    </FormGroup>
  );
}

function GeneralSettings() {
  const { t } = useIntl();
  const updateState = useUpdateConfig();
  const configState = useConfigState();
  const gameData = useGameData();
  const {
    bucketMode,
    constrainPocketPicks,
    orderByAction,
    hideVetos,
    difficulties: selectedDifficulties,
    style: selectedStyle,
    chartCount,
    sortByLevel,
    useGranularLevels,
    showMaxScore,
    playerPicks,
  } = configState;
  const availableDifficulties = useMemo(() => {
    if (!gameData) {
      return [];
    }
    return getAvailableDifficulties(gameData, selectedStyle);
  }, [gameData, selectedStyle]);
  const [expandFilters, setExpandFilters] = useState(false);
  // which editor the collapse should hold. it outlives `bucketMode` going
  // "none" so the panel doesn't swap to the other editor for the length of the
  // closing animation
  const [lastEditor, setLastEditor] = useState<Exclude<BucketMode, "none">>(
    bucketMode === "manual" ? "manual" : "auto",
  );
  const shownEditor = bucketMode === "none" ? lastEditor : bucketMode;
  const getMetaString = useGetMetaString();

  if (!gameData) {
    return null;
  }
  const granularIncrement = new Fraction(
    1,
    gameData.meta.granularTierResolution || 1,
  );
  const { styles: gameStyles } = gameData.meta;

  const usesDrawGroups = !!gameData?.meta.usesDrawGroups;

  function setBucketMode(bucketMode: BucketMode) {
    if (bucketMode !== "none") {
      setLastEditor(bucketMode);
    }
    updateState((prev) => {
      if (bucketMode !== "manual" || prev.manualBuckets.length) {
        return { bucketMode };
      }
      // carry whatever layout they already had into the manual editor, rather
      // than dropping them into an empty list
      return { bucketMode, manualBuckets: seedManualBuckets(prev, gameData) };
    });
  }

  return (
    <>
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
                updateState({ chartCount });
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
                updateState({ playerPicks });
              }
            }}
          />
        </FormGroup>
      </div>
      <MultidrawControls key={configState.id} />
      <FormGroup
        label={t("controls.bucketMode.label")}
        className={styles.bucketSection}
      >
        <SegmentedControl
          fill
          value={bucketMode}
          options={[
            { label: t("controls.bucketMode.none"), value: "none" },
            { label: t("controls.bucketMode.auto"), value: "auto" },
            { label: t("controls.bucketMode.manual"), value: "manual" },
          ]}
          onValueChange={(value) => setBucketMode(value as BucketMode)}
        />
        {/* the lvl range lives in here because it only defines the pool for
            two of the three modes — manual buckets carry their own bounds */}
        <Collapse isOpen={bucketMode !== "manual"}>
          <div className={styles.inlineControls}>
            <LvlRangeControls />
          </div>
        </Collapse>
        {/* one Collapse holding whichever editor is active, rather than one
            per editor: two of them animate in opposite directions at once when
            switching modes, and Collapse slides its body as well as resizing
            it, so the swap reads as a lurch rather than a reveal */}
        <Collapse isOpen={bucketMode !== "none"}>
          {shownEditor === "manual" ? (
            <ManualBucketControls usesTiers={usesDrawGroups} />
          ) : (
            <WeightsControls usesTiers={usesDrawGroups} />
          )}
        </Collapse>
      </FormGroup>
      <Button
        alignText="left"
        endIcon={expandFilters ? <CaretDown /> : <CaretRight />}
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
                      next.difficulties = diffs.map((d) => d.key);
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
                    {getMetaString(style)}
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
                checked={selectedDifficulties.includes(dif.key)}
                onChange={(e) => {
                  const { checked, value } = e.currentTarget;
                  updateState((s) => {
                    const difficulties = new Set(s.difficulties);
                    if (checked) {
                      difficulties.add(value);
                    } else {
                      difficulties.delete(value);
                    }
                    return { difficulties: Array.from(difficulties) };
                  });
                }}
                label={getMetaString(dif.key)}
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
          id="showMaxScore"
          checked={showMaxScore}
          onChange={(e) => {
            const showMaxScore = !!e.currentTarget.checked;
            updateState({ showMaxScore });
          }}
          label={t("controls.showMaxScore")}
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
              return {
                useGranularLevels,
                upperBound: nextUpperBound,
                // hand-authored buckets need the same restating the lvl range
                // above is getting, or they'd keep whole-lvl bounds and match
                // only the charts sitting exactly on them
                manualBuckets: rescaleManualBuckets(
                  prev.manualBuckets,
                  useGranularLevels,
                  gameData,
                ),
              };
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
      </FormGroup>
    </>
  );
}

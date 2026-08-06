import {
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  Input,
  NativeSelect,
  NumberInput,
} from "@mantine/core";
import {
  IconCaretDown,
  IconCaretRight,
  IconPlus,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState, lazy } from "react";
import { useIntl } from "../hooks/useIntl";
import { GameData } from "../models/SongData";
import { WeightsControls } from "./controls-weights";
import styles from "./controls.css";
import { useGetMetaString } from "../game-data-utils";
import { Fraction } from "../utils/fraction";
import {
  ConfigContextProvider,
  useConfigState,
  useGameData,
  useUpdateConfig,
} from "../state/hooks";
import { useStockGameData } from "../state/game-data.atoms";
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
    <Input.Wrapper label={t("controls.include")} mb="md">
      {gameData?.meta.flags.map((key) => (
        <Checkbox
          key={`${dataSetName}:${key}`}
          label={getMetaString(key)}
          value={key}
          my={4}
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
    </Input.Wrapper>
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
    <Input.Wrapper
      label={t("controls.folders")}
      mb="md"
      style={{ opacity: selectedFolders.length ? undefined : 0.8 }}
    >
      <Group gap={4} className={styles.smallText}>
        <Button
          size="compact-xs"
          variant="default"
          leftSection={<IconCheck size={12} />}
          onClick={() => updateState({ folders: availableFolders })}
        >
          All
        </Button>
        <Button
          size="compact-xs"
          variant="default"
          leftSection={<IconX size={12} />}
          onClick={() => updateState({ folders: [] })}
        >
          Ignore Folders
        </Button>
      </Group>
      {availableFolders.map((folder, idx) => (
        <Checkbox
          key={`${dataSetName}:${idx}`}
          label={folder}
          value={folder}
          my={4}
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
    </Input.Wrapper>
  );
}

function GeneralSettings() {
  const { t } = useIntl();
  const updateState = useUpdateConfig();
  const configState = useConfigState();
  const gameData = useStockGameData(configState.gameKey);
  const {
    useWeights,
    constrainPocketPicks,
    orderByAction,
    hideVetos,
    lowerBound,
    upperBound,
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

  return (
    <>
      <div className={styles.inlineControls}>
        <NumberInput
          label={t("controls.chartCount")}
          size="md"
          className={styles.narrowInput}
          inputMode="numeric"
          value={chartCount}
          min={playerPicks ? 0 : 1}
          clampBehavior="blur"
          hideControls
          onChange={(next) => {
            const chartCount = typeof next === "string" ? parseInt(next) : next;
            if (!isNaN(chartCount)) {
              updateState({ chartCount });
            }
          }}
        />
        <IconPlus className={styles.plus} size={20} />
        <NumberInput
          label={t("controls.playerPicks")}
          size="md"
          className={styles.narrowInput}
          inputMode="numeric"
          value={playerPicks}
          min={chartCount ? 0 : 1}
          clampBehavior="blur"
          hideControls
          onChange={(next) => {
            const playerPicks =
              typeof next === "string" ? parseInt(next) : next;
            if (!isNaN(playerPicks)) {
              updateState({ playerPicks });
            }
          }}
        />
      </div>
      <MultidrawControls key={configState.id} />
      <div className={styles.inlineControls}>
        <LvlRangeControls />
      </div>
      <Button
        variant="default"
        fullWidth
        justify="space-between"
        rightSection={
          expandFilters ? (
            <IconCaretDown size={16} />
          ) : (
            <IconCaretRight size={16} />
          )
        }
        onClick={() => setExpandFilters((p) => !p)}
      >
        {t("controls.hideShowFilters")}
      </Button>
      <Collapse expanded={expandFilters}>
        <Card withBorder my="xs" style={{ paddingBottom: "1px" }}>
          {gameStyles.length > 1 && (
            <NativeSelect
              id="style"
              label={t("controls.style")}
              size="md"
              mb="md"
              value={selectedStyle}
              onChange={(e) => {
                const newStyle = e.currentTarget.value;
                updateState((prev) => {
                  const next = { ...prev, style: newStyle };
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
            </NativeSelect>
          )}
          <Input.Wrapper label={t("controls.difficulties")} mb="md">
            {availableDifficulties.map((dif) => (
              <Checkbox
                key={`${dif.key}`}
                name="difficulties"
                value={dif.key}
                my={4}
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
          </Input.Wrapper>
          <ReleaseDateFilter />
          <FlagSettings />
          <FolderSettings />
        </Card>
      </Collapse>
      <Input.Wrapper mt="md">
        <Checkbox
          id="orderByAction"
          my={4}
          checked={orderByAction}
          onChange={(e) => {
            const reorder = !!e.currentTarget.checked;
            updateState({ orderByAction: reorder });
          }}
          label={t("controls.orderByAction")}
        />
        <Checkbox
          id="constrainPocketPicks"
          my={4}
          checked={constrainPocketPicks}
          onChange={(e) => {
            const constrainPocketPicks = !!e.currentTarget.checked;
            updateState({ constrainPocketPicks });
          }}
          label={t("controls.constrainPocketPicks")}
        />
        <Checkbox
          id="sortByLevel"
          my={4}
          checked={sortByLevel}
          onChange={(e) => {
            const sortByLevel = !!e.currentTarget.checked;
            updateState({ sortByLevel });
          }}
          label={t("controls.sortByLevel")}
        />
        <Checkbox
          id="showMaxScore"
          my={4}
          checked={showMaxScore}
          onChange={(e) => {
            const showMaxScore = !!e.currentTarget.checked;
            updateState({ showMaxScore });
          }}
          label={t("controls.showMaxScore")}
        />
        <Checkbox
          id="useGranularLevels"
          my={4}
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
          my={4}
          checked={hideVetos}
          onChange={(e) => {
            const next = !!e.currentTarget.checked;
            updateState({ hideVetos: next });
          }}
          label={t("controls.hideVetos")}
        />
        <Checkbox
          id="weighted"
          my={4}
          checked={useWeights}
          onChange={(e) => {
            const useWeights = !!e.currentTarget.checked;
            updateState({ useWeights });
          }}
          label={t("controls.useWeightedDistributions")}
        />
        <Collapse expanded={useWeights}>
          <WeightsControls
            usesTiers={usesDrawGroups}
            high={upperBound}
            low={lowerBound}
          />
        </Collapse>
      </Input.Wrapper>
    </>
  );
}

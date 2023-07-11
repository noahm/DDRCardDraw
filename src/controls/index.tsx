import {
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Classes,
  Collapse,
  Divider,
  Drawer,
  DrawerSize,
  FormGroup,
  HTMLSelect,
  Icon,
  Intent,
  NavbarDivider,
  NumericInput,
  Position,
  Switch,
  Tab,
  Tabs,
  Tooltip,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import shallow from "zustand/shallow";
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
import { loadConfig, saveConfig } from "../config-persistence";

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
  selectedStyle: string
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

function ShowChartsToggle({ inDrawer }: { inDrawer: boolean }) {
  const { t } = useIntl();
  const { showPool, update } = useConfigState(
    (state) => ({
      showPool: state.showPool,
      update: state.update,
    }),
    shallow
  );
  return (
    <Switch
      alignIndicator={inDrawer ? "left" : "right"}
      large
      className={styles.showAllToggle}
      label={t("showSongPool")}
      checked={showPool}
      onChange={(e) => {
        const showPool = !!e.currentTarget.checked;
        update({
          showPool,
        });
      }}
    />
  );
}

export function HeaderControls() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastDrawFailed, setLastDrawFailed] = useState(false);
  const [drawSongs, hasGameData] = useDrawState((s) => [
    s.drawSongs,
    !!s.gameData,
  ]);
  const isNarrow = useIsNarrow();

  function handleDraw() {
    useConfigState.setState({ showPool: false });
    drawSongs(useConfigState.getState());
  }

  function openSettings() {
    setSettingsOpen((open) => !open);
    setLastDrawFailed(false);
  }

  return (
    <>
      <Drawer
        isOpen={settingsOpen}
        position={Position.RIGHT}
        size={isNarrow ? DrawerSize.LARGE : "500px"}
        onClose={() => setSettingsOpen(false)}
        title={
          <>
            <FormattedMessage id="controls.drawerTitle" />
            <ButtonGroup style={{ marginLeft: "10px" }}>
              <Button icon="floppy-disk" onClick={saveConfig}>
                Save
              </Button>
              <Button icon="import" onClick={loadConfig}>
                Load
              </Button>
            </ButtonGroup>
          </>
        }
      >
        <ControlsDrawer />
      </Drawer>
      {!isNarrow && (
        <>
          <ShowChartsToggle inDrawer={false} />
          <NavbarDivider />
        </>
      )}
      <ButtonGroup>
        <Tooltip disabled={hasGameData} content="Loading game data">
          <Button
            onClick={handleDraw}
            icon={IconNames.NEW_LAYERS}
            intent={Intent.PRIMARY}
            disabled={!hasGameData}
          >
            <FormattedMessage id="draw" />
          </Button>
        </Tooltip>
        <Tooltip
          isOpen={lastDrawFailed}
          content={<FormattedMessage id="controls.invalid" />}
          intent={Intent.DANGER}
          usePortal={false}
          position={Position.BOTTOM_RIGHT}
        >
          <Button icon={IconNames.COG} onClick={openSettings} />
        </Tooltip>
      </ButtonGroup>
    </>
  );
}

function ControlsDrawer() {
  const { t } = useIntl();
  const isConnected = useRemotePeers((r) => !!r.thisPeer);
  const hasPeers = useRemotePeers((r) => !!r.remotePeers.size);
  return (
    <div className={styles.drawer}>
      <Tabs id="settings" large>
        <Tab id="general" icon="settings" panel={<GeneralSettings />}>
          {t("controls.tabs.general")}
        </Tab>
        <Tab
          id="network"
          icon={
            <Icon
              className={Classes.TAB_ICON}
              icon={hasPeers ? IconNames.ThirdParty : IconNames.GlobeNetwork}
              intent={isConnected ? "success" : "none"}
            />
          }
          panel={<RemotePeerControls />}
        >
          {t("controls.tabs.networking")}
        </Tab>
        <Tab id="players" icon="people" panel={<PlayerNamesControls />}>
          {t("controls.tabs.players")}
        </Tab>
      </Tabs>
    </div>
  );
}

function FlagSettings() {
  const { t } = useIntl();
  const [dataSetName, gameData] = useDrawState(
    (s) => [s.dataSetName, s.gameData],
    shallow
  );
  const [updateState, selectedFlags] = useConfigState(
    (s) => [s.update, s.flags],
    shallow
  );

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

function GeneralSettings() {
  const { t } = useIntl();
  const gameData = useDrawState((s) => s.gameData);
  const hasFlags = useDrawState((s) => !!s.gameData?.meta.flags.length);
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
  } = configState;
  const availableDifficulties = useMemo(() => {
    if (!gameData) {
      return [];
    }
    return getAvailableDifficulties(gameData, selectedStyle);
  }, [gameData, selectedStyle]);
  const isNarrow = useIsNarrow();
  const [expandFilters, setExpandFilters] = useState(false);

  if (!gameData) {
    return null;
  }
  const { lvlMax, styles: gameStyles } = gameData.meta;

  const handleLowerBoundChange = (newLow: number) => {
    if (newLow !== lowerBound && !isNaN(newLow)) {
      if (newLow > upperBound) {
        newLow = upperBound;
      }
      updateState({
        lowerBound: newLow,
      });
    }
  };
  const handleUpperBoundChange = (newHigh: number) => {
    if (newHigh !== upperBound && !isNaN(newHigh)) {
      updateState({
        upperBound: newHigh,
      });
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
          <Collapse isOpen={!!configState.flags.size && configState.showPool}>
            <FormGroup label="Show only">
              <EligibleChartsListFilter />
            </FormGroup>
          </Collapse>
          <Divider />
        </>
      )}
      <div className={isNarrow ? undefined : styles.inlineControls}>
        <FormGroup
          label={t("controls.chartCount")}
          contentClassName={styles.narrowInput}
        >
          <NumericInput
            large
            fill
            value={chartCount}
            min={1}
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
              fill
              value={lowerBound}
              min={1}
              max={Math.max(upperBound, lowerBound, 1)}
              clampValueOnBlur
              large
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
              fill
              value={upperBound}
              min={lowerBound}
              max={lvlMax}
              clampValueOnBlur
              large
              onValueChange={handleUpperBoundChange}
            />
          </FormGroup>
        </div>
      </div>
      <Button
        alignText="left"
        rightIcon={expandFilters ? "caret-down" : "caret-right"}
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
                      next.style
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
          {hasFlags && <FlagSettings />}
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

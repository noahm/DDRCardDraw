import { FormattedMessage } from "react-intl";
import { useMemo, useState } from "react";
import { WeightsControls } from "./controls-weights";
import styles from "./controls.css";
import { useDrawState } from "../draw-state";
import { useConfigState } from "../config-state";
import { GameData } from "../models/SongData";
import { useIntl } from "../hooks/useIntl";
import {
  NumericInput,
  Checkbox,
  FormGroup,
  HTMLSelect,
  Drawer,
  Position,
  Button,
  ButtonGroup,
  Intent,
  Switch,
  NavbarDivider,
  DrawerSize,
  Divider,
  Tabs,
  Tab,
  Icon,
} from "@blueprintjs/core";
import { Tooltip2 } from "@blueprintjs/popover2";
import { IconNames } from "@blueprintjs/icons";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { EligibleChartsListFilter } from "../eligible-charts/filter";
import shallow from "zustand/shallow";
import { TournamentModeToggle } from "../tournament-mode/tournament-mode-toggle";
import { RemotePeerControls } from "../tournament-mode/remote-peer-menu";
import { useRemotePeers } from "../tournament-mode/remote-peers";

function getAvailableDifficulties(gameData: GameData, selectedStyle: string) {
  let s = new Set<string>();
  for (const f of gameData.songs) {
    for (const c of f.charts) {
      if (c.style === selectedStyle) {
        s.add(c.diffClass);
      }
    }
  }
  return gameData.meta.difficulties.filter((d) => s.has(d.key));
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
          <FormattedMessage id="settings.title" defaultMessage="Settings" />
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
        <Tooltip2 disabled={hasGameData} content="Loading game data">
          <Button
            onClick={handleDraw}
            icon={IconNames.NEW_LAYERS}
            intent={Intent.PRIMARY}
            disabled={!hasGameData}
          >
            <FormattedMessage id="draw" defaultMessage="Draw!" />
          </Button>
        </Tooltip2>
        <Tooltip2
          isOpen={lastDrawFailed}
          content={<FormattedMessage id="controls.invalid" />}
          intent={Intent.DANGER}
          usePortal={false}
          position={Position.BOTTOM_RIGHT}
        >
          <Button icon={IconNames.COG} onClick={openSettings} />
        </Tooltip2>
      </ButtonGroup>
    </>
  );
}

function ControlsDrawer() {
  const isConnected = useRemotePeers((r) => !!r.thisPeer);
  const hasPeers = useRemotePeers((r) => !!r.remotePeers.size);
  return (
    <div className={styles.drawer}>
      <Tabs id="settings" large>
        <Tab id="general" panel={<GeneralSettings />}>
          <Icon icon={IconNames.Settings} /> General
        </Tab>
        <Tab id="network" panel={<RemotePeerControls />}>
          <Icon
            icon={hasPeers ? IconNames.ThirdParty : IconNames.GlobeNetwork}
            intent={isConnected ? "success" : "none"}
          />{" "}
          Networking
        </Tab>
      </Tabs>
    </div>
  );
}

function GeneralSettings() {
  const { t } = useIntl();
  const [dataSetName, gameData] = useDrawState(
    (s) => [s.dataSetName, s.gameData],
    shallow
  );
  const configState = useConfigState();
  const {
    useWeights,
    constrainPocketPicks,
    orderByAction,
    showVeto,
    lowerBound,
    upperBound,
    update: updateState,
    difficulties: selectedDifficulties,
    flags: selectedFlags,
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

  if (!gameData) {
    return null;
  }
  const { flags, lvlMax, styles: gameStyles } = gameData.meta;

  const handleLowerBoundChange = (newLow: number) => {
    if (newLow !== lowerBound) {
      if (newLow > upperBound) {
        newLow = upperBound;
      }
      updateState({
        lowerBound: newLow,
      });
    }
  };
  const handleUpperBoundChange = (newHigh: number) => {
    if (newHigh !== upperBound) {
      updateState({
        upperBound: newHigh,
      });
    }
  };

  return (
    <>
      {isNarrow && (
        <>
          <FormGroup>
            <ShowChartsToggle inDrawer />
          </FormGroup>
          {!!configState.flags.size && (
            <FormGroup label="Show only">
              <EligibleChartsListFilter />
            </FormGroup>
          )}
          <Divider />
        </>
      )}
      <div className={isNarrow ? undefined : styles.inlineControls}>
        <FormGroup
          label={t("chartCount")}
          contentClassName={styles.narrowInput}
        >
          <NumericInput
            large
            fill
            value={chartCount}
            min={1}
            onValueChange={(chartCount) => {
              updateState((s) => {
                return { ...s, chartCount };
              });
            }}
          />
        </FormGroup>
        <div className={styles.inlineControls}>
          <FormGroup label="Lvl Min" contentClassName={styles.narrowInput}>
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
          <FormGroup label="Lvl Max" contentClassName={styles.narrowInput}>
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
      {gameStyles.length > 1 && (
        <FormGroup labelFor="style" label={t("style")}>
          <HTMLSelect
            id="style"
            large
            value={selectedStyle}
            onChange={(e) => {
              const style = e.currentTarget.value;
              updateState({ style });
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
      <FormGroup label={t("difficulties")}>
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
      {!!flags.length && (
        <FormGroup label={t("include")}>
          {flags.map((key) => (
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
      )}
      <FormGroup>
        <Checkbox
          id="orderByAction"
          checked={orderByAction}
          onChange={(e) => {
            const reorder = !!e.currentTarget.checked;
            updateState({ orderByAction: reorder });
          }}
          label={t("orderByAction")}
        />
        <Checkbox
          id="showVeto"
          checked={showVeto}
          onChange={(e) => {
            const next = !!e.currentTarget.checked;
            updateState({ showVeto: next });
          }}
          label={t("showVeto", undefined, "Show vetoed charts")}
        />
        <Checkbox
          id="constrainPocketPicks"
          checked={constrainPocketPicks}
          onChange={(e) => {
            const constrainPocketPicks = !!e.currentTarget.checked;
            updateState({ constrainPocketPicks });
          }}
          label={t("constrainPocketPicks")}
        />
        <TournamentModeToggle />
        <Checkbox
          id="weighted"
          checked={useWeights}
          onChange={(e) => {
            const useWeights = !!e.currentTarget.checked;
            updateState({ useWeights });
          }}
          label={t("useWeightedDistributions")}
        />
        {useWeights && <WeightsControls high={upperBound} low={lowerBound} />}
      </FormGroup>
    </>
  );
}

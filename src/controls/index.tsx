import { FormattedMessage } from "react-intl";
import { useContext, useMemo, useState } from "react";
import { WeightsControls } from "./controls-weights";
import styles from "./controls.css";
import { DrawStateContext } from "../draw-state";
import { ConfigStateContext } from "../config-state";
import { GameData } from "../models/SongData";
import { useIntl } from "../hooks/useIntl";
import {
  NumericInput,
  Checkbox,
  RangeSlider,
  FormGroup,
  NumberRange,
  HTMLSelect,
  Drawer,
  Position,
  Button,
  ButtonGroup,
  Intent,
  Switch,
  NavbarDivider,
  DrawerSize,
} from "@blueprintjs/core";
import { Tooltip2 } from "@blueprintjs/popover2";
import { IconNames } from "@blueprintjs/icons";
import { useIsNarrow } from "../hooks/useMediaQuery";

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
  const configState = useContext(ConfigStateContext);
  return (
    <Switch
      alignIndicator={inDrawer ? "left" : "right"}
      large
      className={styles.showAllToggle}
      label={t("showSongPool")}
      checked={configState.showPool}
      onChange={(e) => {
        const showPool = !!e.currentTarget.checked;
        configState.update((state) => ({
          ...state,
          showPool,
        }));
      }}
    />
  );
}

export function HeaderControls() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastDrawFailed, setLastDrawFailed] = useState(false);
  const { drawSongs } = useContext(DrawStateContext);
  const configState = useContext(ConfigStateContext);
  const isNarrow = useIsNarrow();

  function handleDraw() {
    configState.update((s) => ({
      ...s,
      showPool: false,
    }));
    const couldDraw = drawSongs(configState);
    if (couldDraw !== !lastDrawFailed) {
      setLastDrawFailed(!couldDraw);
    }
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
          <FormattedMessage
            id="settings.title"
            defaultMessage="Card Draw Options"
          />
        }
      >
        <Controls />
      </Drawer>
      {!isNarrow && (
        <>
          <ShowChartsToggle inDrawer={false} />
          <NavbarDivider />
        </>
      )}
      <ButtonGroup>
        <Button
          onClick={handleDraw}
          icon={IconNames.NEW_LAYERS}
          intent={Intent.PRIMARY}
        >
          <FormattedMessage id="draw" defaultMessage="Draw!" />
        </Button>
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

function Controls() {
  const { t } = useIntl();
  const { dataSetName, gameData } = useContext(DrawStateContext);
  const configState = useContext(ConfigStateContext);
  const {
    useWeights,
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

  const handleBoundsChange = ([low, high]: NumberRange) => {
    if (low !== lowerBound || high !== upperBound) {
      updateState((state) => {
        return {
          ...state,
          lowerBound: low,
          upperBound: high,
        };
      });
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      {isNarrow && (
        <FormGroup>
          <ShowChartsToggle inDrawer />
        </FormGroup>
      )}
      <FormGroup labelFor="chartCount" label={t("chartCount")}>
        <NumericInput
          name="chartCount"
          value={chartCount}
          min={1}
          onValueChange={(chartCount) => {
            updateState((s) => {
              return { ...s, chartCount };
            });
          }}
        />
      </FormGroup>
      <FormGroup label={t("difficultyLevel")}>
        <RangeSlider
          value={[lowerBound, upperBound]}
          min={1}
          max={lvlMax}
          onChange={handleBoundsChange}
          labelStepSize={4}
        />
      </FormGroup>
      {gameStyles.length > 1 && (
        <FormGroup labelFor="style" label={t("style")}>
          <HTMLSelect
            id="style"
            value={selectedStyle}
            onChange={(e) => {
              const style = e.currentTarget.value;
              updateState((s) => {
                return { ...s, style };
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
                return { ...s, difficulties };
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
                  return { ...s, flags: newFlags };
                })
              }
            />
          ))}
        </FormGroup>
      )}
      <FormGroup>
        <Checkbox
          id="weighted"
          checked={useWeights}
          onChange={(e) => {
            const useWeights = !!e.currentTarget.checked;
            updateState((state) => ({
              ...state,
              useWeights,
            }));
          }}
          label={t("useWeightedDistributions")}
        />
        {useWeights && <WeightsControls high={upperBound} low={lowerBound} />}
      </FormGroup>
    </form>
  );
}

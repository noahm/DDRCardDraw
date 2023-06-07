import { FormattedMessage } from "react-intl";
import { useState } from "react";
import { WeightsControls } from "./controls-weights";
import styles from "./controls.css";
import { useDrawState } from "../draw-state";
import {
  configState,
  constrainPocketPicks,
  flags,
  orderByAction,
  showPool,
} from "../config-state";
import { useIntl } from "../hooks/useIntl";
import {
  Checkbox,
  FormGroup,
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
import { EligibleChartsListFilter } from "../eligible-charts-list";
import {
  RecoilState,
  useRecoilCallback,
  useRecoilState,
  useRecoilValue,
} from "recoil";
import { Bounds } from "./bounds";
import { Difficulties } from "./difficulties";
import { Flags } from "./flags";
import { GameStyles } from "./game-styles";
import { ChartCount } from "./chart-count";

function ShowChartsToggle({ inDrawer }: { inDrawer: boolean }) {
  const { t } = useIntl();
  const [checked, setState] = useRecoilState(showPool);
  return (
    <Switch
      alignIndicator={inDrawer ? "left" : "right"}
      large
      className={styles.showAllToggle}
      label={t("showSongPool")}
      checked={checked}
      onChange={(e) => {
        setState(!!e.currentTarget.checked);
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

  const handleDraw = useRecoilCallback(
    (api) => async () => {
      api.set(showPool, false);
      const couldDraw = drawSongs(await api.snapshot.getPromise(configState));
      if (couldDraw !== !lastDrawFailed) {
        setLastDrawFailed(!couldDraw);
      }
    },
    []
  );

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

function ResponsiveEligibleChartsControls() {
  const flagCount = useRecoilValue(flags).size;
  return (
    <>
      <FormGroup>
        <ShowChartsToggle inDrawer />
      </FormGroup>
      {!!flagCount && (
        <FormGroup label="Show only">
          <EligibleChartsListFilter />
        </FormGroup>
      )}
      <hr />
    </>
  );
}

function Controls() {
  const isNarrow = useIsNarrow();

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      {isNarrow && <ResponsiveEligibleChartsControls />}
      <div className={isNarrow ? undefined : styles.inlineControls}>
        <ChartCount />
        <div className={styles.inlineControls}>
          <Bounds />
        </div>
      </div>
      <GameStyles />
      <Difficulties />
      <Flags />
      <FormGroup>
        <RecoilControlledCheckbox
          labelKey="orderByAction"
          atom={orderByAction}
        />
        <RecoilControlledCheckbox
          labelKey="constrainPocketPicks"
          atom={constrainPocketPicks}
        />
        <WeightsControls />
      </FormGroup>
    </form>
  );
}

interface RecoilCheckboxProps {
  atom: RecoilState<boolean>;
  labelKey: string;
}

function RecoilControlledCheckbox(props: RecoilCheckboxProps) {
  const { t } = useIntl();
  const [value, setValue] = useRecoilState(props.atom);
  return (
    <Checkbox
      checked={value}
      onChange={(e) => {
        setValue(e.currentTarget.checked);
      }}
      label={t(props.labelKey)}
    />
  );
}

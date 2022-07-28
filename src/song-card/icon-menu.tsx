import { useIntl } from "../hooks/useIntl";
import { IconNames, IconName } from "@blueprintjs/icons";
import { Menu, MenuItem } from "@blueprintjs/core";
import { DrawnChart } from "../models/Drawing";

interface Props {
  onStartPocketPick: (p: 1 | 2, chart: DrawnChart) => void;
  onVeto: (p: 1 | 2, chart: DrawnChart, chartId: number) => void;
  onProtect: (p: 1 | 2, chart: DrawnChart, chartId: number) => void;
}
export function IconMenu(props: Props) {
  const { onStartPocketPick, onVeto, onProtect } = props;

  const { t } = useIntl();

  return (
    <Menu>
      <MenuPair
        icon={IconNames.LOCK}
        text={t("songAction.lock")}
        onClick={onProtect}
      />
      <MenuPair
        icon={IconNames.INHERITANCE}
        text={t("songAction.pocketPick")}
        onClick={onStartPocketPick}
      />
      <MenuPair
        icon={IconNames.BAN_CIRCLE}
        text={t("songAction.ban")}
        onClick={onVeto}
      />
    </Menu>
  );
}

interface IconRowProps {
  icon: IconName;
  text: string;
  onClick: (p: 1 | 2, chart: DrawnChart, chartId: number) => void;
  chart?: DrawnChart;
}

function MenuPair({ icon, text, onClick, chart }: IconRowProps) {
  return (
    <MenuItem icon={icon} text={text}>
      <MenuItem text="P1" onClick={() => onClick(1, chart as DrawnChart, chart?.id as number)} icon={IconNames.PERSON} />
      <MenuItem text="P2" onClick={() => onClick(2, chart as DrawnChart, chart?.id as number)} icon={IconNames.PERSON} />
    </MenuItem>
  );
}

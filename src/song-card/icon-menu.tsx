import { useIntl } from "../hooks/useIntl";
import { IconNames, IconName } from "@blueprintjs/icons";
import { Menu, MenuItem } from "@blueprintjs/core";

interface Props {
  onStartPocketPick: (p: 1 | 2) => void;
  onVeto: (p: 1 | 2) => void;
  onProtect: (p: 1 | 2) => void;
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
  onClick: (p: 1 | 2) => void;
}

function MenuPair({ icon, text, onClick }: IconRowProps) {
  return (
    <MenuItem icon={icon} text={text}>
      <MenuItem text="P1" onClick={() => onClick(1)} icon={IconNames.PERSON} />
      <MenuItem text="P2" onClick={() => onClick(2)} icon={IconNames.PERSON} />
    </MenuItem>
  );
}

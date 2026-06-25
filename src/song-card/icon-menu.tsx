import { useIntl } from "../hooks/useIntl";
import {
  Inheritance,
  BanCircle,
  Lock,
  Crown,
  Person,
  Refresh,
  Clipboard,
} from "@blueprintjs/icons";
import { Menu, MenuItem, MenuDivider } from "@blueprintjs/core";
import { useDrawing } from "../drawing-context";
import { JSX } from "react";

/** A game-specific info action contributed by a card variant. */
export interface MenuInfoAction {
  key: string;
  /** i18n key for the menu item's label */
  labelKey: string;
  /** fallback label text if `labelKey` isn't found in the active translations */
  labelDefault?: string;
  icon?: JSX.Element;
  onClick: () => void;
}

interface Props {
  onStartPocketPick?: (p: number) => void;
  onVeto?: (p: number) => void;
  onProtect?: (p: number) => void;
  onRedraw?: () => void;
  onSetWinner?: (p: number | null) => void;
  onCopy?: () => void;
  infoActions?: MenuInfoAction[];
}

export function IconMenu(props: Props) {
  const {
    onStartPocketPick,
    onVeto,
    onProtect,
    onRedraw,
    onSetWinner,
    onCopy,
    infoActions,
  } = props;

  const { t } = useIntl();

  return (
    <Menu>
      {onProtect && (
        <PlayerList
          icon={<Lock />}
          text={t("songAction.lock")}
          onClick={onProtect}
        />
      )}
      {onStartPocketPick && (
        <PlayerList
          icon={<Inheritance />}
          text={t("songAction.pocketPick")}
          onClick={onStartPocketPick}
        />
      )}
      {onVeto && (
        <PlayerList
          icon={<BanCircle />}
          text={t("songAction.ban")}
          onClick={onVeto}
        />
      )}
      {onSetWinner && (
        <PlayerList
          icon={<Crown />}
          text={t("songAction.winner")}
          onClick={onSetWinner}
        />
      )}
      {onCopy && (
        <MenuItem
          text={t("songAction.copy")}
          icon={<Clipboard />}
          onClick={onCopy}
        />
      )}
      {infoActions?.map((action) => (
        <MenuItem
          key={action.key}
          text={t(action.labelKey, undefined, action.labelDefault)}
          icon={action.icon}
          onClick={action.onClick}
          // keep the popover open so it can swap to the action's content in place
          shouldDismissPopover={false}
        />
      ))}
      {onRedraw && (
        <>
          <MenuDivider />
          <MenuItem
            text={t("songAction.redraw")}
            icon={<Refresh />}
            onClick={onRedraw}
          />
        </>
      )}
    </Menu>
  );
}

interface IconRowProps {
  icon: JSX.Element;
  text: string;
  onClick: (p: number) => void;
}

function PlayerList({ icon, text, onClick }: IconRowProps) {
  const players = useDrawing((d) => d.players);
  return (
    <MenuItem icon={icon} text={text}>
      {players.map((p, idx) => (
        <MenuItem
          key={idx}
          text={p || `P${idx + 1}`}
          onClick={() => onClick(idx + 1)}
          icon={<Person />}
        />
      ))}
    </MenuItem>
  );
}

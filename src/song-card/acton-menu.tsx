import { useIntl } from "../hooks/useIntl";
import {
  Inheritance,
  BanCircle,
  Lock,
  Crown,
  Person,
  Refresh,
  Clipboard,
  Draw,
} from "@blueprintjs/icons";
import { Menu, MenuItem, MenuDivider } from "@blueprintjs/core";
import { useDrawing } from "../drawing-context";
import { JSX } from "react";

interface Props {
  onStartPocketPick?: (p: string) => void;
  onVeto?: (p: string) => void;
  onProtect?: (p: string) => void;
  onRedraw?: () => void;
  onSetWinner?: (p: string | null) => void;
  onCopy?: () => void;
}

export function ActionMenu(props: Props) {
  const {
    onStartPocketPick,
    onVeto,
    onProtect,
    onRedraw,
    onSetWinner,
    onCopy,
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

export function FillPlaceholderList(props: {
  onFillPlaceholder(p: string): void;
}) {
  const players = useDrawing((d) => d.meta.players);
  return (
    <Menu>
      {players.map((player) => (
        <MenuItem
          key={player.id}
          text={`Pick as ${player.name}`}
          onClick={() => props.onFillPlaceholder(player.id)}
          icon={<Draw />}
        />
      ))}
    </Menu>
  );
}

interface IconRowProps {
  icon: JSX.Element;
  text: string;
  onClick: (p: string) => void;
}

function PlayerList({ icon, text, onClick }: IconRowProps) {
  const players = useDrawing((d) => d.meta.players);
  return (
    <MenuItem icon={icon} text={text}>
      {players.map((player) => (
        <MenuItem
          key={player.id}
          text={player.name}
          onClick={() => onClick(player.id)}
          icon={<Person />}
        />
      ))}
    </MenuItem>
  );
}

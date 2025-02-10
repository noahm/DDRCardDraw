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

interface Props {
  onStartPocketPick?: (p: number) => void;
  onVeto?: (p: number) => void;
  onProtect?: (p: number) => void;
  onRedraw?: () => void;
  onSetWinner?: (p: number | null) => void;
  onCopy?: () => void;
}

export function IconMenu(props: Props) {
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

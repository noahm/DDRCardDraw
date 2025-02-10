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
import { playerNameByIndex } from "../models/Drawing";

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
  const drawingMeta = useDrawing((d) => d.meta);
  const players = useDrawing((d) => d.playerDisplayOrder).map(
    (pIdx) => [playerNameByIndex(drawingMeta, pIdx), pIdx] as const,
  );
  return (
    <MenuItem icon={icon} text={text}>
      {players.map(([playerName, pIdx]) => (
        <MenuItem
          key={pIdx}
          text={playerName}
          onClick={() => onClick(pIdx)}
          icon={<Person />}
        />
      ))}
    </MenuItem>
  );
}

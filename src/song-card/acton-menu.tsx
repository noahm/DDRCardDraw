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
import { playerNameByIndex } from "../models/Drawing";
import { JSX } from "react";

interface Props {
  onStartPocketPick?: (p: number) => void;
  onVeto?: (p: number) => void;
  onProtect?: (p: number) => void;
  onRedraw?: () => void;
  onSetWinner?: (p: number | null) => void;
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
  onFillPlaceholder(p: number): void;
}) {
  const drawingMeta = useDrawing((d) => d.meta);
  const players = useDrawing((d) => d.playerDisplayOrder).map(
    (pIdx) => [playerNameByIndex(drawingMeta, pIdx), pIdx] as const,
  );
  return (
    <Menu>
      {players.map(([playerName, pIdx]) => (
        <MenuItem
          key={pIdx}
          text={`Pick as ${playerName}`}
          onClick={() => props.onFillPlaceholder(pIdx)}
          icon={<Draw />}
        />
      ))}
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

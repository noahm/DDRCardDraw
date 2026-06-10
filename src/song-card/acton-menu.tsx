import { useIntl } from "../hooks/useIntl";
import {
  IconArrowsSplit,
  IconBan,
  IconLock,
  IconCrown,
  IconUser,
  IconRefresh,
  IconClipboard,
  IconScribble,
} from "@tabler/icons-react";
import { Menu } from "@mantine/core";
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

/** rendered inside a Menu.Dropdown */
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
    <>
      {onProtect && (
        <PlayerList
          icon={<IconLock size={16} />}
          text={t("songAction.lock")}
          onClick={onProtect}
        />
      )}
      {onStartPocketPick && (
        <PlayerList
          icon={<IconArrowsSplit size={16} />}
          text={t("songAction.pocketPick")}
          onClick={onStartPocketPick}
        />
      )}
      {onVeto && (
        <PlayerList
          icon={<IconBan size={16} />}
          text={t("songAction.ban")}
          onClick={onVeto}
        />
      )}
      {onSetWinner && (
        <PlayerList
          icon={<IconCrown size={16} />}
          text={t("songAction.winner")}
          onClick={onSetWinner}
        />
      )}
      {onCopy && (
        <Menu.Item leftSection={<IconClipboard size={16} />} onClick={onCopy}>
          {t("songAction.copy")}
        </Menu.Item>
      )}
      {onRedraw && (
        <>
          <Menu.Divider />
          <Menu.Item leftSection={<IconRefresh size={16} />} onClick={onRedraw}>
            {t("songAction.redraw")}
          </Menu.Item>
        </>
      )}
    </>
  );
}

/** rendered inside a Menu.Dropdown */
export function FillPlaceholderList(props: {
  onFillPlaceholder(p: number): void;
}) {
  const drawingMeta = useDrawing((d) => d.meta);
  const players = useDrawing((d) => d.playerDisplayOrder).map(
    (pIdx) => [playerNameByIndex(drawingMeta, pIdx), pIdx] as const,
  );
  return (
    <>
      {players.map(([playerName, pIdx]) => (
        <Menu.Item
          key={pIdx}
          onClick={() => props.onFillPlaceholder(pIdx)}
          leftSection={<IconScribble size={16} />}
        >
          Pick as {playerName}
        </Menu.Item>
      ))}
    </>
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
    <Menu.Sub>
      <Menu.Sub.Target>
        <Menu.Sub.Item leftSection={icon}>{text}</Menu.Sub.Item>
      </Menu.Sub.Target>
      <Menu.Sub.Dropdown>
        {players.map(([playerName, pIdx]) => (
          <Menu.Item
            key={pIdx}
            onClick={() => onClick(pIdx)}
            leftSection={<IconUser size={16} />}
          >
            {playerName}
          </Menu.Item>
        ))}
      </Menu.Sub.Dropdown>
    </Menu.Sub>
  );
}

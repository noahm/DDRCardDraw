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
import { JSX } from "react";
import { useGetMetaString } from "../game-data-utils";

/** A game-specific info action contributed by a card variant. */
export interface MenuInfoAction {
  key: string;
  /** a bare game-data i18n key, resolved against the active game's strings */
  labelKey: string;
  icon?: JSX.Element;
  onClick: () => void;
}

interface Props {
  onStartPocketPick?: (p: string) => void;
  onVeto?: (p: string) => void;
  onProtect?: (p: string) => void;
  onRedraw?: () => void;
  onSetWinner?: (p: string | null) => void;
  onCopy?: () => void;
  infoActions?: MenuInfoAction[];
  /**
   * The menu was opened on behalf of this player (by index, in display
   * order), so the per-player actions apply to them directly instead of
   * asking which player through a submenu.
   */
  playerIndex?: number;
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
    infoActions,
    playerIndex,
  } = props;

  const { t } = useIntl();
  const getMetaString = useGetMetaString();
  const actingPlayer = useDrawing((d) =>
    playerIndex === undefined ? undefined : d.meta?.players[playerIndex],
  );
  const hasPlayerActions = !!(
    onProtect ||
    onStartPocketPick ||
    onVeto ||
    onSetWinner
  );

  return (
    <>
      {actingPlayer && hasPlayerActions && (
        <Menu.Label>As {actingPlayer.name}</Menu.Label>
      )}
      {onProtect && (
        <PlayerList
          icon={<IconLock size={16} />}
          text={t("songAction.lock")}
          onClick={onProtect}
          playerIndex={playerIndex}
        />
      )}
      {onStartPocketPick && (
        <PlayerList
          icon={<IconArrowsSplit size={16} />}
          text={t("songAction.pocketPick")}
          onClick={onStartPocketPick}
          playerIndex={playerIndex}
        />
      )}
      {onVeto && (
        <PlayerList
          icon={<IconBan size={16} />}
          text={t("songAction.ban")}
          onClick={onVeto}
          playerIndex={playerIndex}
        />
      )}
      {onSetWinner && (
        <PlayerList
          icon={<IconCrown size={16} />}
          text={t("songAction.winner")}
          onClick={onSetWinner}
          playerIndex={playerIndex}
        />
      )}
      {onCopy && (
        <Menu.Item leftSection={<IconClipboard size={16} />} onClick={onCopy}>
          {t("songAction.copy")}
        </Menu.Item>
      )}
      {infoActions?.map((action) => (
        <Menu.Item
          key={action.key}
          leftSection={action.icon}
          onClick={action.onClick}
          // keep the dropdown open so it can swap to the action's content in place
          closeMenuOnClick={false}
        >
          {getMetaString(action.labelKey)}
        </Menu.Item>
      ))}
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
  onFillPlaceholder(p: string): void;
  /** only offer the pick to this player (by index, in display order) */
  playerIndex?: number;
}) {
  const allPlayers = useDrawing((d) => d.meta.players);
  const players =
    props.playerIndex === undefined
      ? allPlayers
      : allPlayers.slice(props.playerIndex, props.playerIndex + 1);
  return (
    <>
      {players.map((player) => (
        <Menu.Item
          key={player.id}
          onClick={() => props.onFillPlaceholder(player.id)}
          leftSection={<IconScribble size={16} />}
        >
          Pick as {player.name}
        </Menu.Item>
      ))}
    </>
  );
}

interface IconRowProps {
  icon: JSX.Element;
  text: string;
  onClick: (p: string) => void;
  /** act for this player directly, rather than offering a submenu of them all */
  playerIndex?: number;
}

function PlayerList({ icon, text, onClick, playerIndex }: IconRowProps) {
  const players = useDrawing((d) => d.meta.players);
  const actingPlayer =
    playerIndex === undefined ? undefined : players[playerIndex];
  if (actingPlayer) {
    return (
      <Menu.Item leftSection={icon} onClick={() => onClick(actingPlayer.id)}>
        {text}
      </Menu.Item>
    );
  }
  return (
    <Menu.Sub>
      <Menu.Sub.Target>
        <Menu.Sub.Item leftSection={icon}>{text}</Menu.Sub.Item>
      </Menu.Sub.Target>
      <Menu.Sub.Dropdown>
        {players.map((player) => (
          <Menu.Item
            key={player.id}
            onClick={() => onClick(player.id)}
            leftSection={<IconUser size={16} />}
          >
            {player.name}
          </Menu.Item>
        ))}
      </Menu.Sub.Dropdown>
    </Menu.Sub>
  );
}

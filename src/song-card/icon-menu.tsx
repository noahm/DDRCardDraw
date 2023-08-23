import { useIntl } from "../hooks/useIntl";
import { IconNames, IconName } from "@blueprintjs/icons";
import { Menu, MenuItem, MenuDivider } from "@blueprintjs/core";
import { useDrawing } from "../drawing-context";

interface Props {
  onStartPocketPick?: (p: number) => void;
  onVeto?: (p: number) => void;
  onProtect?: (p: number) => void;
  onRedraw?: () => void;
  onSetWinner?: (p: number | null) => void;
}

export function IconMenu(props: Props) {
  const { onStartPocketPick, onVeto, onProtect, onRedraw, onSetWinner } = props;

  const { t } = useIntl();

  return (
    <Menu>
      {onProtect && (
        <PlayerList
          icon={IconNames.LOCK}
          text={t("songAction.lock")}
          onClick={onProtect}
        />
      )}
      {onStartPocketPick && (
        <PlayerList
          icon={IconNames.INHERITANCE}
          text={t("songAction.pocketPick")}
          onClick={onStartPocketPick}
        />
      )}
      {onVeto && (
        <PlayerList
          icon={IconNames.BAN_CIRCLE}
          text={t("songAction.ban")}
          onClick={onVeto}
        />
      )}
      {onSetWinner && (
        <PlayerList
          icon={IconNames.CROWN}
          text={t("songAction.winner")}
          onClick={onSetWinner}
        />
      )}
      {onRedraw && (
        <>
          <MenuDivider />
          <MenuItem text="Redraw" icon={IconNames.REFRESH} onClick={onRedraw} />
        </>
      )}
    </Menu>
  );
}

interface IconRowProps {
  icon: IconName;
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
          icon={IconNames.PERSON}
        />
      ))}
    </MenuItem>
  );
}

import { useState } from "react";
import { SongSearch } from "../song-search";
import { DrawnChart } from "../models/Drawing";
import { useIntl } from "../hooks/useIntl";
import { IconNames, IconName } from "@blueprintjs/icons";
import { Dialog, Menu, MenuItem } from "@blueprintjs/core";

interface Props {
  onPocketPicked: (p: 1 | 2, chart: DrawnChart) => void;
  onVeto: (p: 1 | 2) => void;
  onProtect: (p: 1 | 2) => void;
}

export function IconMenu(props: Props) {
  const { onPocketPicked, onVeto, onProtect } = props;

  const { t } = useIntl();
  const [playerPickingPocket, setPickingPocket] = useState<0 | 1 | 2>(0);

  return (
    <Menu>
      <Dialog
        onClose={() => setPickingPocket(0)}
        isOpen={!!playerPickingPocket}
      >
        <SongSearch
          autofocus
          onSongSelect={(_song, chart) =>
            onPocketPicked(playerPickingPocket as 1 | 2, chart)
          }
          onCancel={() => setPickingPocket(0)}
        />
      </Dialog>
      <MenuPair
        icon={IconNames.LOCK}
        text={t("songAction.lock")}
        onClick={onProtect}
      />
      <MenuPair
        icon={IconNames.INHERITANCE}
        text={t("songAction.pocketPick")}
        onClick={setPickingPocket}
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

import { useState } from "react";
import { SongSearch } from "../song-search";
import styles from "./icon-menu.css";
import { DrawnChart } from "../models/Drawing";
import { useIntl } from "../hooks/useIntl";
import { IconNames, IconName } from "@blueprintjs/icons";
import { Button, Dialog } from "@blueprintjs/core";

interface Props {
  onPocketPicked: (p: 1 | 2, chart: DrawnChart) => void;
  onVeto: (p: 1 | 2) => void;
  onProtect: (p: 1 | 2) => void;
  onClose: () => void;
  onReset: () => void;
  onlyReset: boolean;
}

export function IconMenu(props: Props) {
  const { onPocketPicked, onVeto, onProtect, onClose, onlyReset, onReset } =
    props;

  const { t } = useIntl();
  const [playerPickingPocket, setPickingPocket] = useState<0 | 1 | 2>(0);

  if (onlyReset) {
    return (
      <div className={styles.iconMenu} onClick={(e) => e.stopPropagation()}>
        <header className={styles.centerRow}>
          <span>{t("songAction.reset")}</span>
          <span>{t("songAction.cancel")}</span>
        </header>
        <div className={styles.centerRow}>
          <Button
            icon={IconNames.RESET}
            title={t("songAction.reset")}
            onClick={onReset}
          />
          <Button
            icon={IconNames.CROSS}
            onClick={onClose}
            title={t("songAction.cancel")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.iconMenu} onClick={(e) => e.stopPropagation()}>
      <Dialog
        onClose={() => setPickingPocket(0)}
        isOpen={!!playerPickingPocket}
      >
        <SongSearch
          autofocus
          onSongSelect={(song, chart) =>
            onPocketPicked(playerPickingPocket as 1 | 2, chart)
          }
          onCancel={() => setPickingPocket(0)}
        />
      </Dialog>
      <header className={styles.iconRow}>
        <div>P1</div>
        <Button
          icon={IconNames.CROSS}
          onClick={onClose}
          title={t("songAction.cancel")}
        />
        <div>P2</div>
      </header>
      <IconRow
        icon={IconNames.LOCK}
        label={t("songAction.lock")}
        onClick={onProtect}
      />
      <IconRow
        icon={IconNames.INHERITANCE}
        label={t("songAction.pocketPick")}
        onClick={setPickingPocket}
      />
      <IconRow
        icon={IconNames.BAN_CIRCLE}
        label={t("songAction.ban")}
        onClick={onVeto}
      />
    </div>
  );
}

interface IconRowProps {
  icon: IconName;
  label: string;
  onClick: (p: 1 | 2) => void;
}

function IconRow({ icon, label, onClick }: IconRowProps) {
  return (
    <div className={styles.iconRow}>
      <Button icon={icon} title={label} onClick={() => onClick(1)} />
      <div>{label}</div>
      <Button icon={icon} title={label} onClick={() => onClick(2)} />
    </div>
  );
}

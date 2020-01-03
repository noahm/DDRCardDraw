import { TranslateContext } from "@denysvuika/preact-translate";
import { Edit, Lock, RotateCcw, Slash, X } from "preact-feather";
import { useContext, useState } from "preact/hooks";
import { Icon } from "../icon";
import { SongSearch } from "../song-search";
import styles from "./icon-menu.css";
import { JSX } from "preact";
import { DrawnChart } from "../models/Drawing";

interface Props {
  onPocketPicked: (p: 1 | 2, chart: DrawnChart) => void;
  onVeto: (p: 1 | 2) => void;
  onProtect: (p: 1 | 2) => void;
  onClose: () => void;
  onReset: () => void;
  onlyReset: boolean;
}

export function IconMenu(props: Props) {
  const {
    onPocketPicked,
    onVeto,
    onProtect,
    onClose,
    onlyReset,
    onReset
  } = props;

  const { t } = useContext(TranslateContext);
  const [playerPickingPocket, setPickingPocket] = useState<0 | 1 | 2>(0);

  if (playerPickingPocket) {
    return (
      <SongSearch
        autofocus
        onSongSelect={chart => onPocketPicked(playerPickingPocket, chart)}
        onCancel={() => setPickingPocket(0)}
      />
    );
  }

  if (onlyReset) {
    return (
      <div className={styles.iconMenu} onClick={e => e.stopPropagation()}>
        <header className={styles.centerRow}>
          <span>{t("songAction.reset")}</span>
          <span>{t("songAction.cancel")}</span>
        </header>
        <div className={styles.centerRow}>
          <Icon
            svg={<RotateCcw />}
            title={t("songAction.reset")}
            onClick={onReset}
          />
          <Icon svg={<X />} onClick={onClose} title={t("songAction.cancel")} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.iconMenu} onClick={e => e.stopPropagation()}>
      <header className={styles.iconRow}>
        <div>P1</div>
        <Icon svg={<X />} onClick={onClose} title={t("songAction.cancel")} />
        <div>P2</div>
      </header>
      <IconRow
        icon={<Lock />}
        label={t("songAction.lock")}
        onClick={onProtect}
      />
      <IconRow
        icon={<Edit />}
        label={t("songAction.pocketPick")}
        onClick={setPickingPocket}
      />
      <IconRow icon={<Slash />} label={t("songAction.ban")} onClick={onVeto} />
    </div>
  );
}

interface IconRowProps {
  icon: JSX.Element;
  label: string;
  onClick: (p: 1 | 2) => void;
}

function IconRow({ icon, label, onClick }: IconRowProps) {
  return (
    <div className={styles.iconRow}>
      <Icon svg={icon} title={label} onClick={() => onClick(1)} />
      <div>{label}</div>
      <Icon svg={icon} title={label} onClick={() => onClick(2)} />
    </div>
  );
}

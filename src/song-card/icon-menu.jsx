import { TranslateContext } from "@denysvuika/preact-translate";
import { Edit, Lock, Trash, X } from "preact-feather";
import { useContext, useState } from "preact/hooks";
import { Icon } from "../icon";
import { SongSearch } from "../song-search";
import styles from "./icon-menu.css";

export function IconMenu(props) {
  const { onPocketPicked, onVeto, onProtect, onClose } = props;

  const { t } = useContext(TranslateContext);
  const [pickingPocket, setPickingPocket] = useState(false);
  const onPickPocket = () => setPickingPocket(true);

  if (pickingPocket) {
    return (
      <SongSearch
        autofocus
        onSongSelect={chart => onPocketPicked(chart)}
        onCancel={() => setPickingPocket(false)}
      />
    );
  }

  return (
    <div className={styles.iconMenu} onClick={e => e.stopPropagation()}>
      <header className={styles.iconRow}>
        <div>P1</div>
        <Icon svg={<X />} onClick={onClose} />
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
        onClick={onPickPocket}
      />
      <IconRow icon={<Trash />} label={t("songAction.ban")} onClick={onVeto} />
    </div>
  );
}

function IconRow(props) {
  const { icon, label, onClick } = props;

  return (
    <div className={styles.iconRow}>
      <Icon svg={icon} title={label} onClick={onClick} />
      <div>{label}</div>
      <Icon svg={icon} title={label} onClick={onClick} />
    </div>
  );
}

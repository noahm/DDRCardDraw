import classNames from "classnames";
import { detectedLanguage } from "./utils";
import styles from "./song-card.css";
import { Icon } from "./icon";
import { useState, useContext } from "preact/hooks";
import { SongSearch } from "./song-search";
import { Edit, Lock, Trash, Zap } from "preact-feather";
import { TranslateContext } from "@denysvuika/preact-translate";

const isJapanese = detectedLanguage === "ja";

function IconMenu(props) {
  const { onPocketPicked, onVeto, onProtect } = props;

  const [pickingPocket, setPickingPocket] = useState(false);
  const propsForChildren = {
    onVeto,
    onProtect,
    onPickPocket: () => setPickingPocket(true)
  };

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
      <IconColumn header="P1" {...propsForChildren} />
      <IconColumn header="P2" {...propsForChildren} />
    </div>
  );
}

function IconColumn(props) {
  const { header, onPickPocket, onVeto, onProtect } = props;

  return (
    <div className={styles.iconColumn}>
      <p>{header}</p>
      <Icon svg={<Lock />} title="Protect" onClick={onProtect} />
      <Icon
        svg={<Edit />}
        title="Replace with Pocket Pick"
        onClick={onPickPocket}
      />
      <Icon svg={<Trash />} title="Ban" onClick={onVeto} />
    </div>
  );
}

export function SongCard(props) {
  const {
    name,
    nameTranslation,
    artist,
    artistTranslation,
    bpm,
    difficulty,
    level,
    hasShock,
    vetoed,
    abbreviation,
    jacket,
    onVeto,
    isPocket
  } = props;

  const { t } = useContext(TranslateContext);
  const [pocket, updatePocket] = useState(null);
  const [showingIconMenu, setShowIconMenu] = useState(false);
  const showIcons = () => setShowIconMenu(true);
  const hideIcons = () => {
    setShowIconMenu(false);
    return true;
  };

  if (!isPocket && pocket) {
    return <SongCard {...pocket} isPocket />;
  }

  const rootClassname = classNames(styles.chart, styles[difficulty], {
    [styles.vetoed]: vetoed
  });

  let jacketBg = {};
  if (jacket) {
    jacketBg = {
      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), url("jackets/${jacket}")`
    };
  }

  return (
    <div
      className={rootClassname}
      onClick={showingIconMenu ? undefined : showIcons}
    >
      {showingIconMenu && (
        <IconMenu
          onProtect={hideIcons}
          onPocketPicked={chart => hideIcons() && updatePocket(chart)}
          onVeto={() => hideIcons() && onVeto()}
        />
      )}
      <div className={styles.cardCenter} style={jacketBg}>
        <div className={styles.name} title={nameTranslation}>
          {name}
        </div>
        {isJapanese ? null : (
          <div className={styles.nameTranslation}>{nameTranslation}</div>
        )}
        <div className={styles.artist} title={artistTranslation}>
          {artist}
        </div>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.bpm}>{bpm} BPM</div>
        {hasShock && (
          <div className={styles.shockBadge} title={t("shockArrows")}>
            <Zap
              size={12}
              ariaHidden
              color="black"
              fill="yellow"
              stroke-width="1"
            />
          </div>
        )}
        <div className={styles.difficulty}>
          {t(abbreviation)} {level}
        </div>
      </div>
    </div>
  );
}

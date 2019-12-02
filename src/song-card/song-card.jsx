import classNames from "classnames";
import { detectedLanguage } from "../utils";
import styles from "./song-card.css";
import { useState, useContext } from "preact/hooks";
import { Zap, Trash, Lock, Edit } from "preact-feather";
import { TranslateContext } from "@denysvuika/preact-translate";
import { IconMenu } from "./icon-menu";
import { CardLabel } from "./card-label";

const isJapanese = detectedLanguage === "ja";

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
    isProtected,
    abbreviation,
    jacket,
    onVeto,
    onProtect,
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
    [styles.vetoed]: vetoed,
    [styles.protected]: isProtected || isPocket
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
      {vetoed && (
        <CardLabel>
          P1
          <Trash size={16} />
        </CardLabel>
      )}
      {isProtected && (
        <CardLabel>
          P1
          <Lock size={16} />
        </CardLabel>
      )}
      {isPocket && (
        <CardLabel>
          P1
          <Edit size={16} />
        </CardLabel>
      )}
      {showingIconMenu && (
        <IconMenu
          onProtect={() => hideIcons() && onProtect()}
          onPocketPicked={chart => hideIcons() && updatePocket(chart)}
          onVeto={() => hideIcons() && onVeto()}
          onClose={hideIcons}
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

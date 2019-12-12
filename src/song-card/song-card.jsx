import classNames from "classnames";
import { detectedLanguage } from "../utils";
import styles from "./song-card.css";
import { useState, useContext } from "preact/hooks";
import { Zap, Lock, Edit, Slash } from "preact-feather";
import { TranslateContext } from "@denysvuika/preact-translate";
import { IconMenu } from "./icon-menu";
import { CardLabel } from "./card-label";

const isJapanese = detectedLanguage === "ja";

export function SongCard(props) {
  const {
    chart,
    vetoedBy,
    protectedBy,
    replacedBy,
    replacedWith,
    onVeto,
    onProtect,
    onReplace,
    onReset
  } = props;

  const { t } = useContext(TranslateContext);
  const [showingIconMenu, setShowIconMenu] = useState(false);
  const showIcons = () => setShowIconMenu(true);
  const hideIcons = () => {
    setShowIconMenu(false);
    return true;
  };

  const {
    name,
    nameTranslation,
    artist,
    artistTranslation,
    bpm,
    difficulty,
    level,
    hasShock,
    abbreviation,
    jacket
  } = replacedWith || chart;

  const rootClassname = classNames(styles.chart, styles[difficulty], {
    [styles.vetoed]: vetoedBy,
    [styles.protected]: protectedBy || replacedBy
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
      {vetoedBy && (
        <CardLabel left={vetoedBy === 1}>
          P{vetoedBy}
          <Slash size={16} />
        </CardLabel>
      )}
      {protectedBy && (
        <CardLabel left={protectedBy === 1}>
          P{protectedBy}
          <Lock size={16} />
        </CardLabel>
      )}
      {replacedBy && (
        <CardLabel left={replacedBy === 1}>
          P{replacedBy}
          <Edit size={16} />
        </CardLabel>
      )}
      {showingIconMenu && (
        <IconMenu
          onProtect={player => hideIcons() && onProtect(player)}
          onPocketPicked={(player, chart) =>
            hideIcons() && onReplace(player, chart)
          }
          onVeto={player => hideIcons() && onVeto(player)}
          onlyReset={vetoedBy || protectedBy || replacedBy}
          onReset={() => hideIcons() && onReset()}
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

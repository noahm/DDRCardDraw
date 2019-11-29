import classNames from "classnames";
import { detectedLanguage } from "./utils";
import styles from "./song-card.css";
import { Localizer, Text } from "preact-i18n";
import { Icon } from "./icon";
import { useState } from "preact/hooks";
import { SongSearch } from "./song-search";
import { Modal } from "./modal";

import walletIcon from "ionicons/dist/ionicons/svg/md-wallet.svg";
import lockIcon from "ionicons/dist/ionicons/svg/md-lock.svg";
import banIcon from "ionicons/dist/ionicons/svg/md-close-circle.svg";

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
      <Icon src={lockIcon} title="Protect" onClick={onProtect} />
      <Icon
        src={walletIcon}
        title="Replace with Pocket Pick"
        onClick={onPickPocket}
      />
      <Icon src={banIcon} title="Ban" onClick={onVeto} />
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
          <Localizer>
            <div
              className={styles.shockBadge}
              title={<Text id="shockArrows">Shock Arrows</Text>}
            >
              <svg
                height="100%"
                className="octicon octicon-zap"
                viewBox="0 0 10 16"
                version="1.1"
                ariaHidden="true"
              >
                <path fillRule="evenodd" d="M10 7H6l3-7-9 9h4l-3 7 9-9z" />
              </svg>
            </div>
          </Localizer>
        )}
        <div className={styles.difficulty}>
          <Text id={abbreviation} /> {level}
        </div>
      </div>
    </div>
  );
}

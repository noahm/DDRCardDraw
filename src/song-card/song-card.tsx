import classNames from "classnames";
import { detectedLanguage } from "../utils";
import styles from "./song-card.css";
import { useState } from "react";
import { IconMenu } from "./icon-menu";
import { CardLabel, LabelType } from "./card-label";
import { DrawnChart } from "../models/Drawing";
import { AbbrDifficulty } from "../game-data-utils";
import { useDifficultyColor } from "../hooks/useDifficultyColor";
import { ShockBadge } from "./shock-badge";
import { Popover2 } from "@blueprintjs/popover2";
import { SongSearch } from "../song-search";

const isJapanese = detectedLanguage === "ja";

type Player = 1 | 2;

interface IconCallbacks {
  onVeto: (p: Player, chart: DrawnChart, chartId: number) => void;
  onProtect: (p: Player, chart: DrawnChart, chartId: number) => void;
  onReplace: (p: Player, chart: DrawnChart, chartId: number) => void;
  onReset: () => void;
}

interface Props {
  chart: DrawnChart;
  vetoedBy?: Player;
  protectedBy?: Player;
  replacedBy?: Player;
  replacedWith?: DrawnChart;
  iconCallbacks?: IconCallbacks;
}

export function SongCard(props: Props) {
  const {
    chart,
    vetoedBy,
    protectedBy,
    replacedBy,
    replacedWith,
    iconCallbacks,
  } = props;

  const [showingIconMenu, setShowIconMenu] = useState(false);
  const showIcons = () => setShowIconMenu(true);
  const hideIcons = () => setShowIconMenu(false);

  const [pocketPickForPlayer, setPocketPickForPlayer] = useState<0 | 1 | 2>(0);

  const {
    name,
    nameTranslation,
    artist,
    artistTranslation,
    bpm,
    difficultyClass,
    level,
    hasShock,
    jacket
  } = replacedWith || chart;
  const diffAccentColor = useDifficultyColor(difficultyClass);

  const hasLabel = !!(vetoedBy || protectedBy || replacedBy);

  const rootClassname = classNames(styles.chart, {
    [styles.vetoed]: vetoedBy,
    [styles.protected]: protectedBy,
    [styles.replaced]: replacedBy,
    [styles.clickable]: !!iconCallbacks && !hasLabel,
  });

  let jacketBg = {};
  if (jacket) {
    jacketBg = {
      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), url("jackets/${jacket}")`,
    };
  }

  let menuContent: undefined | JSX.Element;
  if (iconCallbacks) {
    menuContent = (
      <IconMenu
        onProtect={iconCallbacks.onProtect}
        onStartPocketPick={setPocketPickForPlayer}
        onVeto={iconCallbacks.onVeto}
      />
    );
  }

  return (
    <div
      className={rootClassname}
      onClick={
        showingIconMenu || hasLabel || pocketPickForPlayer
          ? undefined
          : showIcons
      }
    >
      <SongSearch
        isOpen={!!pocketPickForPlayer}
        onSongSelect={(song, chart) => {
          iconCallbacks &&
            chart &&
            iconCallbacks.onReplace(pocketPickForPlayer as 1 | 2, chart, chart.id as number);
          setPocketPickForPlayer(0);
        }}
        onCancel={() => setPocketPickForPlayer(0)}
      />
      {vetoedBy && (
        <CardLabel
          player={vetoedBy}
          type={LabelType.Ban}
          onRemove={iconCallbacks?.onReset}
        />
      )}
      {protectedBy && (
        <CardLabel
          player={protectedBy}
          type={LabelType.Protect}
          onRemove={iconCallbacks?.onReset}
        />
      )}
      {replacedBy && (
        <CardLabel
          player={replacedBy}
          type={LabelType.Pocket}
          onRemove={iconCallbacks?.onReset}
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

      <Popover2
        content={menuContent}
        isOpen={showingIconMenu}
        onClose={hideIcons}
        placement="top"
        modifiers={{
          offset: { options: { offset: [0, 35] } },
        }}
      >
        <div
          className={styles.cardFooter}
          style={{ backgroundColor: diffAccentColor }}
        >
          <div className={styles.bpm}>{bpm} BPM</div>
          {hasShock && <ShockBadge />}
          <div className={styles.difficulty}>
            <AbbrDifficulty diffClass={difficultyClass} /> {level}
          </div>
        </div>
      </Popover2>
    </div>
  );
}

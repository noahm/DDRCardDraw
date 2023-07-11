import { Popover } from "@blueprintjs/core";
import classNames from "classnames";
import { useLayoutEffect, useMemo, useState } from "react";
import { shallow } from "zustand/shallow";
import { useConfigState } from "../config-state";
import { useDrawing } from "../drawing-context";
import { DrawnChart, EligibleChart } from "../models/Drawing";
import { SongSearch } from "../song-search";
import { detectedLanguage } from "../utils";
import { CardLabel, LabelType } from "./card-label";
import { IconMenu } from "./icon-menu";
import { ShockBadge } from "./shock-badge";
import styles from "./song-card.css";

const isJapanese = detectedLanguage === "ja";

type Player = 1 | 2;

interface IconCallbacks {
  onVeto: (p: Player) => void;
  onProtect: (p: Player) => void;
  onReplace: (p: Player, chart: EligibleChart) => void;
  onRedraw: () => void;
  onReset: () => void;
  onSetWinner: (p: Player | null) => void;
}

interface Props {
  onClick?: () => void;
  chart: DrawnChart | EligibleChart;
  vetoedBy?: Player;
  protectedBy?: Player;
  replacedBy?: Player;
  winner?: Player;
  replacedWith?: EligibleChart;
  actionsEnabled?: boolean;
  revealWithDelayMs?: number;
  onReveal?(): void;
}

export { Props as SongCardProps };

function useIconCallbacksForChart(chartId: number): IconCallbacks {
  const [handleBanPickPocket, redrawChart, resetChart, setWinner] = useDrawing(
    (d) => [
      d.handleBanProtectReplace,
      d.redrawChart,
      d.resetChart,
      d.setWinner,
    ],
    shallow
  );

  return useMemo(
    () => ({
      onVeto: handleBanPickPocket.bind(undefined, "ban", chartId),
      onProtect: handleBanPickPocket.bind(undefined, "protect", chartId),
      onReplace: handleBanPickPocket.bind(undefined, "pocket", chartId),
      onRedraw: redrawChart.bind(undefined, chartId),
      onReset: resetChart.bind(undefined, chartId),
      onSetWinner: setWinner.bind(undefined, chartId),
    }),
    [handleBanPickPocket, chartId, redrawChart, resetChart, setWinner]
  );
}

export function SongCard(props: Props) {
  const {
    chart,
    vetoedBy,
    protectedBy,
    replacedBy,
    replacedWith,
    winner,
    actionsEnabled,
    revealWithDelayMs,
    onReveal,
  } = props;
  const hideVetos = useConfigState((s) => s.hideVetos);

  const [showingContextMenu, setContextMenuOpen] = useState(false);
  const showMenu = () => setContextMenuOpen(true);
  const hideMenu = () => setContextMenuOpen(false);
  const [isFaceDown, setIsFaceDown] = useState(
    typeof revealWithDelayMs === "number"
  );
  const animDelay = revealWithDelayMs || 0;

  useLayoutEffect(() => {
    if (isFaceDown) {
      const timeout = setTimeout(() => {
        setIsFaceDown(false);
        if (onReveal) {
          onReveal();
        }
      }, animDelay);
      return () => clearTimeout(timeout);
    }
  }, [animDelay, isFaceDown, onReveal]);

  const [pocketPickPendingForPlayer, setPocketPickPendingForPlayer] = useState<
    0 | 1 | 2
  >(0);

  const {
    name,
    nameTranslation,
    artist,
    artistTranslation,
    bpm,
    diffAbbr,
    diffColor,
    level,
    jacket,
    flags,
  } = replacedWith || chart;

  const hasLabel = !!(vetoedBy || protectedBy || replacedBy);

  let jacketBg = {};
  if (jacket) {
    jacketBg = {
      backgroundImage: `url("jackets/${jacket}")`,
    };
  }

  const iconCallbacks = useIconCallbacksForChart((chart as DrawnChart).id);

  let menuContent: undefined | JSX.Element;
  if (actionsEnabled && !winner) {
    if (!hasLabel) {
      menuContent = (
        <IconMenu
          onProtect={iconCallbacks.onProtect}
          onStartPocketPick={setPocketPickPendingForPlayer}
          onVeto={iconCallbacks.onVeto}
          onRedraw={iconCallbacks.onRedraw}
          onSetWinner={iconCallbacks.onSetWinner}
        />
      );
    } else if (!vetoedBy) {
      menuContent = <IconMenu onSetWinner={iconCallbacks.onSetWinner} />;
    }
  }

  const containerClass = classNames(styles.cardContainer, {
    [styles.vetoed]: vetoedBy,
    [styles.protected]: protectedBy,
    [styles.replaced]: replacedBy,
    [styles.clickable]: !!menuContent || !!props.onClick,
    [styles.hideVeto]: hideVetos,
    [styles.faceDown]: isFaceDown,
  });

  return (
    <div
      className={containerClass}
      onClick={
        isFaceDown
          ? () => setIsFaceDown(false)
          : !menuContent || showingContextMenu || pocketPickPendingForPlayer
          ? props.onClick
          : showMenu
      }
    >
      <div className={styles.cardContents}>
        <div className={styles.frontFace} style={jacketBg}>
          <SongSearch
            isOpen={!!pocketPickPendingForPlayer}
            onSongSelect={(song, chart) => {
              actionsEnabled &&
                chart &&
                iconCallbacks.onReplace(
                  pocketPickPendingForPlayer as 1 | 2,
                  chart
                );
              setPocketPickPendingForPlayer(0);
            }}
            onCancel={() => setPocketPickPendingForPlayer(0)}
          />
          <div className={styles.cardCenter}>
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
            {winner && (
              <CardLabel
                player={winner}
                type={LabelType.Winner}
                onRemove={() => iconCallbacks?.onSetWinner(null)}
              />
            )}
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

          <Popover
            content={menuContent}
            isOpen={showingContextMenu}
            onClose={hideMenu}
            placement="top"
            modifiers={{
              offset: { options: { offset: [0, 35] } },
            }}
          >
            <div
              className={styles.cardFooter}
              style={{ backgroundColor: diffColor }}
            >
              <div className={styles.bpm}>{bpm} BPM</div>
              {flags.includes("shock") && <ShockBadge />}
              <div className={styles.difficulty}>
                {diffAbbr} {level}
              </div>
            </div>
          </Popover>
        </div>
        <div className={styles.backFace} />
      </div>
    </div>
  );
}

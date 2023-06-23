import classNames from "classnames";
import { detectedLanguage } from "../utils";
import styles from "./song-card.css";
import { useMemo, useState } from "react";
import { IconMenu } from "./icon-menu";
import { CardLabel, LabelType } from "./card-label";
import { DrawnChart, EligibleChart } from "../models/Drawing";
import { ShockBadge } from "./shock-badge";
import { Popover2 } from "@blueprintjs/popover2";
import { SongSearch } from "../song-search";
import shallow from "zustand/shallow";
import { useDrawing } from "../drawing-context";
import { useConfigState } from "../config-state";

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
  chart: DrawnChart | EligibleChart;
  vetoedBy?: Player;
  protectedBy?: Player;
  replacedBy?: Player;
  winner?: Player;
  replacedWith?: EligibleChart;
  actionsEnabled?: boolean;
}

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
    [handleBanPickPocket, redrawChart, resetChart, chartId]
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
  } = props;
  const showVeto = useConfigState((s) => s.showVeto);

  const [showingContextMenu, setContextMenuOpen] = useState(false);
  const showMenu = () => setContextMenuOpen(true);
  const hideMenu = () => setContextMenuOpen(false);

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

  let iconCallbacks = useIconCallbacksForChart((chart as DrawnChart).id);

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

  const rootClassname = classNames(styles.chart, {
    [styles.vetoed]: vetoedBy,
    [styles.protected]: protectedBy,
    [styles.replaced]: replacedBy,
    [styles.clickable]: !!menuContent,
    [styles.hideVeto]: !showVeto,
  });

  return (
    <div
      className={rootClassname}
      onClick={
        !menuContent || showingContextMenu || pocketPickPendingForPlayer
          ? undefined
          : showMenu
      }
      style={jacketBg}
    >
      <SongSearch
        isOpen={!!pocketPickPendingForPlayer}
        onSongSelect={(song, chart) => {
          actionsEnabled &&
            chart &&
            iconCallbacks.onReplace(pocketPickPendingForPlayer as 1 | 2, chart);
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

      <Popover2
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
      </Popover2>
    </div>
  );
}

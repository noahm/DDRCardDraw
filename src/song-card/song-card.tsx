import { Popover } from "@blueprintjs/core";
import classNames from "classnames";
import { useCallback, useMemo, useState } from "react";
import { shallow } from "zustand/shallow";
import { useConfigState } from "../config-state";
import { useDrawing } from "../drawing-context";
import {
  CHART_PLACEHOLDER,
  DrawnChart,
  EligibleChart,
  PlayerPickPlaceholder,
} from "../models/Drawing";
import { SongSearch } from "../song-search";
import { detectedLanguage } from "../utils";
import { CardLabel, LabelType } from "./card-label";
import { IconMenu } from "./icon-menu";
import { ShockBadge } from "./shock-badge";
import styles from "./song-card.css";
import { ChartLevel } from "./chart-level";
import { copyTextToClipboard } from "../utils/share";

const isJapanese = detectedLanguage === "ja";

type Player = number;

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
  chart: DrawnChart | EligibleChart | PlayerPickPlaceholder;
  vetoedBy?: Player;
  protectedBy?: Player;
  replacedBy?: Player;
  winner?: Player;
  replacedWith?: EligibleChart;
  actionsEnabled?: boolean;
}

export { Props as SongCardProps };

function useIconCallbacksForChart(chartId: string): IconCallbacks {
  const [handleBanPickPocket, redrawChart, resetChart, setWinner] = useDrawing(
    (d) => [
      d.handleBanProtectReplace,
      d.redrawChart,
      d.resetChart,
      d.setWinner,
    ],
    shallow,
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
    [handleBanPickPocket, chartId, redrawChart, resetChart, setWinner],
  );
}

function baseChartValues(
  chart: EligibleChart | DrawnChart | PlayerPickPlaceholder,
): Partial<EligibleChart> & { name: string } {
  if ("type" in chart && chart.type === CHART_PLACEHOLDER) {
    return {
      name: "Your Pick Here",
    };
  }
  return chart;
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
  const hideVetos = useConfigState((s) => s.hideVetos);

  const [showingContextMenu, setContextMenuOpen] = useState(false);
  const showMenu = () => setContextMenuOpen(true);
  const hideMenu = () => setContextMenuOpen(false);

  const [pocketPickPendingForPlayer, setPocketPickPendingForPlayer] =
    useState<number>(0);

  const baseChartIsPlaceholder =
    "type" in chart && chart.type === CHART_PLACEHOLDER;

  const {
    name,
    nameTranslation,
    artist,
    artistTranslation,
    bpm,
    diffAbbr,
    diffColor,
    jacket,
    flags,
    dateAdded,
  } = replacedWith || baseChartValues(chart);

  const hasLabel = !!(vetoedBy || protectedBy || replacedBy);

  let jacketBg = {};
  if (jacket) {
    const prefix = jacket.startsWith("blob:") ? "" : "jackets/";
    jacketBg = {
      backgroundImage: `url("${prefix}${jacket}")`,
    };
  }

  const iconCallbacks = useIconCallbacksForChart((chart as DrawnChart).id);
  const handleCopy = useCallback(() => {
    if (!diffAbbr) {
      return;
    }
    copyTextToClipboard(
      `${name} [${diffAbbr.toUpperCase()}]`,
      "Copied name & difficulty",
    );
  }, [name, diffAbbr]);
  const canCopy = !!name && !!diffAbbr;

  let menuContent: undefined | JSX.Element;
  if (actionsEnabled && !winner) {
    if (!replacedWith && baseChartIsPlaceholder) {
      menuContent = (
        <IconMenu onStartPocketPick={setPocketPickPendingForPlayer} />
      );
    } else if (!hasLabel) {
      menuContent = (
        <IconMenu
          onProtect={iconCallbacks.onProtect}
          onStartPocketPick={setPocketPickPendingForPlayer}
          onVeto={iconCallbacks.onVeto}
          onRedraw={iconCallbacks.onRedraw}
          onSetWinner={iconCallbacks.onSetWinner}
          onCopy={handleCopy}
        />
      );
    } else if (!vetoedBy) {
      menuContent = (
        <IconMenu onSetWinner={iconCallbacks.onSetWinner} onCopy={handleCopy} />
      );
    }
  }

  const rootClassname = classNames(styles.chart, {
    [styles.vetoed]: vetoedBy,
    [styles.protected]: protectedBy,
    [styles.replaced]: replacedBy && !baseChartIsPlaceholder,
    [styles.picked]: replacedBy && baseChartIsPlaceholder,
    [styles.clickable]: !!menuContent || !!props.onClick || canCopy,
    [styles.hideVeto]: hideVetos,
  });

  return (
    <div
      className={rootClassname}
      onClick={
        !menuContent || showingContextMenu || pocketPickPendingForPlayer
          ? props.onClick || handleCopy
          : showMenu
      }
      style={jacketBg}
    >
      <SongSearch
        isOpen={!!pocketPickPendingForPlayer}
        onSongSelect={(song, chart) => {
          if (actionsEnabled && chart) {
            iconCallbacks.onReplace(pocketPickPendingForPlayer as 1 | 2, chart);
          }
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
            type={
              baseChartIsPlaceholder ? LabelType.FreePick : LabelType.Pocket
            }
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
        <div className={styles.dateAdded} title={dateAdded}>
          {dateAdded}
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
          {bpm ? <div className={styles.bpm}>{bpm} BPM</div> : <div />}
          {flags?.includes("shock") && <ShockBadge />}
          <div className={styles.difficulty}>
            {diffAbbr} <ChartLevel chart={replacedWith || chart} />
          </div>
        </div>
      </Popover>
    </div>
  );
}

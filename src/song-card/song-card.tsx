import { Popover } from "@blueprintjs/core";
import classNames from "classnames";
import { useCallback, useMemo, useState } from "react";
import { useConfigState } from "../state/hooks";
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
import { useAppDispatch } from "../state/store";
import { createPickBanPocket, createRedrawChart } from "../state/thunks";
import { getJacketUrl } from "../utils/jackets";
import { drawingsSlice } from "../state/drawings.slice";

const isJapanese = detectedLanguage === "ja";

type PlayerIdx = number;

interface IconCallbacks {
  onVeto: (p: PlayerIdx) => void;
  onProtect: (p: PlayerIdx) => void;
  onReplace: (p: PlayerIdx, chart: EligibleChart) => void;
  onRedraw: () => void;
  onReset: () => void;
  onSetWinner: (p: PlayerIdx | null) => void;
}

interface Props {
  onClick?: () => void;
  chart: DrawnChart | EligibleChart | PlayerPickPlaceholder;
  vetoedBy?: PlayerIdx;
  protectedBy?: PlayerIdx;
  replacedBy?: PlayerIdx;
  winner?: PlayerIdx | null;
  replacedWith?: EligibleChart;
  actionsEnabled?: boolean;
}

export { Props as SongCardProps };

function useIconCallbacksForChart(chartId: string): IconCallbacks {
  const dispatch = useAppDispatch();
  const drawingId = useDrawing((s) => s.id);

  const handleBanPickPocket = useCallback(
    (
      type: "ban" | "protect" | "pocket",
      player: number,
      pick?: EligibleChart,
    ) => dispatch(createPickBanPocket(drawingId, chartId, type, player, pick)),
    [drawingId, chartId, dispatch],
  );

  return useMemo(
    () => ({
      onVeto: handleBanPickPocket.bind(undefined, "ban"),
      onProtect: handleBanPickPocket.bind(undefined, "protect"),
      onReplace: handleBanPickPocket.bind(undefined, "pocket"),
      onRedraw: () => {
        dispatch(createRedrawChart(drawingId, chartId));
      },
      onReset: () =>
        dispatch(drawingsSlice.actions.resetChart({ drawingId, chartId })),
      onSetWinner: (player) =>
        dispatch(
          drawingsSlice.actions.setWinner({ drawingId, chartId, player }),
        ),
    }),
    [handleBanPickPocket, drawingId, chartId, dispatch],
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
    useState<PlayerIdx | null>(null);

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

  const hasLabel = !!(
    vetoedBy !== undefined ||
    protectedBy !== undefined ||
    replacedBy !== undefined
  );
  const hasWinner = typeof winner === "number";

  let jacketBg = {};
  if (jacket) {
    jacketBg = {
      backgroundImage: `url("${getJacketUrl(jacket)}")`,
    };
  }

  const iconCallbacks = useIconCallbacksForChart((chart as DrawnChart).id);

  let menuContent: undefined | JSX.Element;
  if (actionsEnabled && !hasWinner) {
    if (replacedWith !== undefined && baseChartIsPlaceholder) {
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
        />
      );
    } else if (vetoedBy === undefined) {
      menuContent = <IconMenu onSetWinner={iconCallbacks.onSetWinner} />;
    }
  }

  const rootClassname = classNames(styles.chart, {
    [styles.vetoed]: vetoedBy !== undefined,
    [styles.protected]: protectedBy !== undefined,
    [styles.replaced]: replacedBy !== undefined && !baseChartIsPlaceholder,
    [styles.picked]: replacedBy !== undefined && baseChartIsPlaceholder,
    [styles.clickable]: !!menuContent || !!props.onClick,
    [styles.hideVeto]: hideVetos,
  });

  return (
    <div
      className={rootClassname}
      onClick={
        !menuContent ||
        showingContextMenu ||
        pocketPickPendingForPlayer !== null
          ? props.onClick
          : showMenu
      }
      style={jacketBg}
    >
      <SongSearch
        isOpen={pocketPickPendingForPlayer !== null}
        onSongSelect={(song, chart) => {
          if (actionsEnabled && chart) {
            iconCallbacks.onReplace(pocketPickPendingForPlayer!, chart);
          }
          setPocketPickPendingForPlayer(null);
        }}
        onCancel={() => setPocketPickPendingForPlayer(null)}
      />
      <div className={styles.cardCenter}>
        {vetoedBy !== undefined && (
          <CardLabel
            playerIdx={vetoedBy}
            type={LabelType.Ban}
            onRemove={iconCallbacks?.onReset}
          />
        )}
        {protectedBy !== undefined && (
          <CardLabel
            playerIdx={protectedBy}
            type={LabelType.Protect}
            onRemove={iconCallbacks?.onReset}
          />
        )}
        {replacedBy !== undefined && (
          <CardLabel
            playerIdx={replacedBy}
            type={
              baseChartIsPlaceholder ? LabelType.FreePick : LabelType.Pocket
            }
            onRemove={iconCallbacks?.onReset}
          />
        )}
        {hasWinner && (
          <CardLabel
            playerIdx={winner}
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

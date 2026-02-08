import { Popover } from "@blueprintjs/core";
import classNames from "classnames";
import {
  type JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { FillPlaceholderList, ActionMenu } from "./acton-menu";
import { ShockBadge } from "./shock-badge";
import styles from "./song-card.css";
import { ChartLevel } from "./chart-level";
import { useAppDispatch } from "../state/store";
import { createPickBanPocket, createRedrawChart } from "../state/thunks";
import { getJacketUrl } from "../utils/jackets";
import { drawingsSlice } from "../state/drawings.slice";
import { copyTextToClipboard } from "../utils/share";
import { useChartRandomSelected } from "../tournament-mode/highlight-random";

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
  const drawingId = useDrawing((s) => s.compoundId);

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
    return { name: "Your Pick Here" };
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

  const [wasRandomlySelected, clearRandomSelection] =
    useChartRandomSelected(chart);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (wasRandomlySelected && rootRef.current) {
      rootRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [wasRandomlySelected]);

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
    jacketBg = { backgroundImage: `url("${getJacketUrl(jacket)}")` };
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
  if (actionsEnabled && !hasWinner) {
    if (replacedWith === undefined && baseChartIsPlaceholder) {
      menuContent = (
        <FillPlaceholderList
          onFillPlaceholder={setPocketPickPendingForPlayer}
        />
      );
    } else if (!hasLabel) {
      menuContent = (
        <ActionMenu
          onProtect={iconCallbacks.onProtect}
          onStartPocketPick={setPocketPickPendingForPlayer}
          onVeto={iconCallbacks.onVeto}
          onRedraw={iconCallbacks.onRedraw}
          onSetWinner={iconCallbacks.onSetWinner}
          onCopy={handleCopy}
        />
      );
    } else if (vetoedBy === undefined) {
      menuContent = (
        <ActionMenu
          onSetWinner={iconCallbacks.onSetWinner}
          onCopy={handleCopy}
        />
      );
    }
  }

  const rootClassname = classNames(styles.chart, {
    [styles.vetoed]: vetoedBy !== undefined,
    [styles.protected]: protectedBy !== undefined,
    [styles.replaced]: replacedBy !== undefined && !baseChartIsPlaceholder,
    [styles.picked]: replacedBy !== undefined && baseChartIsPlaceholder,
    [styles.clickable]: !!menuContent || !!props.onClick || canCopy,
    [styles.hideVeto]: hideVetos,
    [styles.randomSelected]: wasRandomlySelected,
  });

  const handleCardClick = menuContent ? showMenu : props.onClick || handleCopy;

  return (
    <Popover
      isOpen={wasRandomlySelected}
      onClose={clearRandomSelection}
      content={<div style={{ padding: "0.5em" }}>This one!</div>}
      targetTagName="div"
      className={styles.popoverWrapper}
    >
      <div
        ref={rootRef}
        className={rootClassname}
        onClick={
          showingContextMenu || pocketPickPendingForPlayer !== null
            ? undefined
            : handleCardClick
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
          modifiers={{ offset: { options: { offset: [0, 35] } } }}
        >
          <div
            className={styles.cardFooter}
            style={{ backgroundColor: diffColor }}
          >
            {bpm ? <div className={styles.bpm}>{bpm} BPM</div> : <div />}
            {flags?.includes("shock") && <ShockBadge />}
            {flags?.includes("noCmod") && "🚫"}
            <div className={styles.difficulty}>
              {diffAbbr} <ChartLevel chart={replacedWith || chart} />
            </div>
          </div>
        </Popover>
      </div>
    </Popover>
  );
}

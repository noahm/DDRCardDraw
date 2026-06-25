import { Popover } from "@blueprintjs/core";
import classNames from "classnames";
import React, { JSX, useCallback, useMemo, useState } from "react";
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
import { CardLabel, LabelType } from "./card-label";
import { IconMenu } from "./icon-menu";
import styles from "./song-card.css";
import { copyTextToClipboard } from "../utils/share";
import { baseChartValues, CardContentsProps } from "./variants";

type Player = number;

interface IconCallbacks {
  onVeto: (p: Player) => void;
  onProtect: (p: Player) => void;
  onReplace: (p: Player, chart: EligibleChart) => void;
  onRedraw: () => void;
  onReset: () => void;
  onSetWinner: (p: Player | null) => void;
}

export interface SongCardProps {
  onClick?: () => void;
  chart: DrawnChart | EligibleChart | PlayerPickPlaceholder;
  vetoedBy?: Player;
  protectedBy?: Player;
  replacedBy?: Player;
  winner?: Player;
  replacedWith?: EligibleChart;
  actionsEnabled?: boolean;
}

type Props = SongCardProps & CardContentsProps;

export { Props as SongCardBaseProps };

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

export function SongCardBase(props: Props) {
  const {
    chart,
    vetoedBy,
    protectedBy,
    replacedBy,
    replacedWith,
    winner,
    actionsEnabled,
    CenterContent,
    FooterContent,
    getActions,
  } = props;
  const hideVetos = useConfigState((s) => s.hideVetos);

  const [showingContextMenu, setContextMenuOpen] = useState(false);
  const showMenu = () => setContextMenuOpen(true);
  const hideMenu = () => setContextMenuOpen(false);

  // key of the variant-supplied action whose popover is currently shown, if any
  const [openActionKey, setOpenActionKey] = useState<string | null>(null);

  const [pocketPickPendingForPlayer, setPocketPickPendingForPlayer] =
    useState<number>(0);

  const baseChartIsPlaceholder =
    "type" in chart && chart.type === CHART_PLACEHOLDER;

  const { name, diffAbbr, jacket } = replacedWith || baseChartValues(chart);

  const hasLabel = !!(vetoedBy || protectedBy || replacedBy);

  // extra, game-specific info popovers contributed by the active card variant
  const variantActions = getActions?.(replacedWith || chart) ?? [];
  const openAction = variantActions.find((a) => a.key === openActionKey);
  const infoActions = variantActions.length
    ? variantActions.map((a) => ({
        key: a.key,
        labelKey: a.labelKey,
        labelDefault: a.labelDefault,
        icon: a.icon,
        // hand off from the action menu to this action's popover on the same card
        onClick: () => {
          setContextMenuOpen(false);
          setOpenActionKey(a.key);
        },
      }))
    : undefined;

  let jacketBg = {};
  if (jacket) {
    const prefix = jacket.startsWith("blob:") ? "" : "jackets/";
    jacketBg = {
      backgroundImage: `url("${prefix}${jacket}")`,
    };
  }

  const iconCallbacks = useIconCallbacksForChart((chart as DrawnChart).id);
  const handleCopy = useCallback(async () => {
    if (!diffAbbr) {
      return;
    }
    await copyTextToClipboard(
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
          infoActions={infoActions}
        />
      );
    } else if (!vetoedBy) {
      menuContent = (
        <IconMenu
          onSetWinner={iconCallbacks.onSetWinner}
          onCopy={handleCopy}
          infoActions={infoActions}
        />
      );
    }
  }
  // even without other actions, variant info actions are still worth offering
  if (!menuContent && infoActions) {
    menuContent = (
      <IconMenu
        infoActions={infoActions}
        onCopy={canCopy ? handleCopy : undefined}
      />
    );
  }

  const rootClassname = classNames(styles.chart, {
    [styles.vetoed]: vetoedBy,
    [styles.protected]: protectedBy,
    [styles.replaced]: replacedBy && !baseChartIsPlaceholder,
    [styles.picked]: replacedBy && baseChartIsPlaceholder,
    [styles.clickable]: !!menuContent || !!props.onClick || canCopy,
    [styles.hideVeto]: hideVetos,
  });

  const handleCardClick = menuContent ? showMenu : props.onClick || handleCopy;

  const actionLabels = (
    <>
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
          type={baseChartIsPlaceholder ? LabelType.FreePick : LabelType.Pocket}
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
    </>
  );

  return (
    <div
      className={rootClassname}
      onClick={
        showingContextMenu || openAction || pocketPickPendingForPlayer
          ? undefined
          : handleCardClick
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
        {actionLabels}
        <CenterContent chart={replacedWith || chart} />
      </div>

      <Popover
        content={openAction ? openAction.content : menuContent}
        isOpen={showingContextMenu || !!openAction}
        onClose={() => {
          hideMenu();
          setOpenActionKey(null);
        }}
        placement="top"
        modifiers={{
          offset: { options: { offset: [0, 15] } },
        }}
      >
        <FooterContent chart={replacedWith || chart} />
      </Popover>
    </div>
  );
}

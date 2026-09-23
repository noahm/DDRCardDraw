import { Menu, Popover } from "@mantine/core";
import classNames from "classnames";
import {
  type JSX,
  type KeyboardEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDrawing } from "../drawing-context";
import {
  CHART_PLACEHOLDER,
  DrawnChart,
  EligibleChart,
  PlayerPickPlaceholder,
} from "../models/Drawing";
import { CardLabel, LabelType } from "./card-label";
import { FillPlaceholderList, ActionMenu } from "./acton-menu";
import styles from "./song-card.css";
import { useAppDispatch } from "../state/store";
import { createPickBanPocket, createRedrawChart } from "../state/thunks";
import { getJacketUrl } from "../utils/jackets";
import { drawingsSlice } from "../state/drawings.slice";
import { copyTextToClipboard } from "../utils/share";
import { useChartRandomSelected } from "../tournament-mode/highlight-random";

import { baseChartValues, CardContentsProps } from "./variants";
import {
  CARD_GROUP_ATTR,
  CARD_NAV_ATTR,
  cardsInGroup,
  focusCard,
  focusIsAdrift,
  handleCardArrowKey,
  noteCardFocused,
} from "../utils/card-nav";

/**
 * The song search omnibar is only reachable through a card's action menu, so it
 * loads on demand. It gets mounted (closed) as soon as that menu opens rather
 * than when a pocket pick starts, so that its own `isOpen` prop still drives
 * the overlay's enter and exit transitions -- conditionally rendering it on
 * `pocketPickPendingForPlayer` would tear the overlay out of the tree before it
 * could animate closed.
 */
const SongSearch = lazy(() =>
  import("../song-search").then((m) => ({ default: m.SongSearch })),
);

type PlayerId = string;

interface IconCallbacks {
  onVeto: (p: PlayerId) => void;
  onProtect: (p: PlayerId) => void;
  onReplace: (p: PlayerId, chart: EligibleChart) => void;
  onRedraw: () => void;
  onReset: () => void;
  onSetWinner: (p: PlayerId | null) => void;
}

export interface SongCardProps {
  onClick?: () => void;
  chart: DrawnChart | EligibleChart | PlayerPickPlaceholder;
  vetoedBy?: PlayerId;
  protectedBy?: PlayerId;
  replacedBy?: PlayerId;
  winner?: PlayerId | null;
  replacedWith?: EligibleChart;
  actionsEnabled?: boolean;
}

type Props = SongCardProps & CardContentsProps;

export { Props as SongCardBaseProps };

function useIconCallbacksForChart(chartId: string): IconCallbacks {
  const dispatch = useAppDispatch();
  const drawingId = useDrawing((s) => s.compoundId);

  const handleBanPickPocket = useCallback(
    (
      type: "ban" | "protect" | "pocket",
      player: string,
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
  // a menu opened from the keyboard lands focus on its first item, while one
  // opened by pointer keeps Mantine's focus placeholder so no item looks active
  const [menuOpenedByKeyboard, setMenuOpenedByKeyboard] = useState(false);
  const [songSearchMounted, setSongSearchMounted] = useState(false);
  const showMenu = (viaKeyboard = false) => {
    setSongSearchMounted(true);
    setMenuOpenedByKeyboard(viaKeyboard);
    setContextMenuOpen(true);
  };
  const hideMenu = () => setContextMenuOpen(false);

  // key of the variant-supplied action whose popover is currently shown, if any
  const [openActionKey, setOpenActionKey] = useState<string | null>(null);

  const [pocketPickPendingForPlayer, setPocketPickPendingForPlayer] =
    useState<PlayerId | null>(null);

  const baseChartIsPlaceholder =
    "type" in chart && chart.type === CHART_PLACEHOLDER;

  const { name, diffAbbr, jacket } = replacedWith || baseChartValues(chart);

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

  // extra, game-specific info popovers contributed by the active card variant
  const variantActions = getActions?.(replacedWith || chart) ?? [];
  const openAction = variantActions.find((a) => a.key === openActionKey);
  const infoActions = variantActions.length
    ? variantActions.map((a) => ({
        key: a.key,
        labelKey: a.labelKey,
        icon: a.icon,
        // hand off from the action menu to this action's popover on the same card
        onClick: () => {
          setContextMenuOpen(false);
          setOpenActionKey(a.key);
        },
      }))
    : undefined;

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
          infoActions={infoActions}
        />
      );
    } else if (vetoedBy === undefined) {
      menuContent = (
        <ActionMenu
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
      <ActionMenu
        infoActions={infoActions}
        onCopy={canCopy ? handleCopy : undefined}
      />
    );
  }

  const rootClassname = classNames(styles.chart, {
    [styles.vetoed]: vetoedBy !== undefined,
    [styles.protected]: protectedBy !== undefined,
    [styles.replaced]: replacedBy !== undefined && !baseChartIsPlaceholder,
    [styles.picked]: replacedBy !== undefined && baseChartIsPlaceholder,
    [styles.clickable]: !!menuContent || !!props.onClick || canCopy,
    [styles.randomSelected]: wasRandomlySelected,
  });

  const isClickable = !!menuContent || !!props.onClick || canCopy;
  const handleCardClick = menuContent
    ? () => showMenu()
    : props.onClick || handleCopy;
  const overlayOpen =
    showingContextMenu || !!openAction || pocketPickPendingForPlayer !== null;

  /**
   * Put focus back on this card once whatever held it (a label's remove
   * button, the song search) has gone away, unless it already moved on.
   */
  const refocusCard = (force = false) =>
    requestAnimationFrame(() => {
      const el = rootRef.current;
      if (el?.isConnected && (force || focusIsAdrift())) {
        el.focus();
      }
    });

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // keys pressed inside the card's menu or on a label's remove button bubble
    // here through the React tree; those belong to that control, not the card
    if (e.target !== e.currentTarget || overlayOpen) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (menuContent) {
        showMenu(true);
      } else {
        handleCardClick();
      }
    } else if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (handleCardArrowKey(e.currentTarget, e.key)) {
        e.preventDefault();
      }
    }
  };

  /*
   * A redraw swaps this card for a new one, and a veto with vetoes hidden takes
   * it out of the list altogether, both straight from this card's own menu. The
   * focus the menu would hand back has nowhere to go then, so pass it on to
   * whichever card now sits in this one's place in the set.
   */
  const menuOwnsFocusRef = useRef(false);
  useLayoutEffect(() => {
    menuOwnsFocusRef.current = overlayOpen;
  }, [overlayOpen]);
  useLayoutEffect(() => {
    const el = rootRef.current;
    const group = el?.closest<HTMLElement>(`[${CARD_GROUP_ATTR}]`);
    if (!el || !group) return;
    return () => {
      const active = document.activeElement;
      const hadFocus =
        el.contains(active) ||
        !!active?.closest("[data-card-menu]") ||
        menuOwnsFocusRef.current;
      if (!hadFocus) return;
      const index = cardsInGroup(group).indexOf(el);
      setTimeout(() => {
        if (!focusIsAdrift() || !group.isConnected) return;
        const cards = cardsInGroup(group);
        const next = cards[Math.min(Math.max(index, 0), cards.length - 1)];
        if (next) focusCard(next);
      });
    };
  }, []);

  const actionLabels = (
    <>
      {vetoedBy !== undefined && (
        <CardLabel
          playerId={vetoedBy}
          type={LabelType.Ban}
          onRemove={() => {
            iconCallbacks.onReset();
            refocusCard();
          }}
        />
      )}
      {protectedBy !== undefined && (
        <CardLabel
          playerId={protectedBy}
          type={LabelType.Protect}
          onRemove={() => {
            iconCallbacks.onReset();
            refocusCard();
          }}
        />
      )}
      {replacedBy !== undefined && (
        <CardLabel
          playerId={replacedBy}
          type={baseChartIsPlaceholder ? LabelType.FreePick : LabelType.Pocket}
          onRemove={() => {
            iconCallbacks.onReset();
            refocusCard();
          }}
        />
      )}
      {winner !== undefined && winner !== null && (
        <CardLabel
          playerId={winner}
          type={LabelType.Winner}
          onRemove={() => {
            iconCallbacks.onSetWinner(null);
            refocusCard();
          }}
        />
      )}
    </>
  );

  return (
    <Popover
      opened={wasRandomlySelected}
      onDismiss={clearRandomSelection}
      position="bottom"
      withArrow
    >
      <Popover.Target>
        <div
          ref={rootRef}
          className={rootClassname}
          onClick={overlayOpen ? undefined : handleCardClick}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            if (e.target === e.currentTarget) noteCardFocused(e.currentTarget);
          }}
          tabIndex={isClickable ? 0 : undefined}
          role={isClickable ? "button" : undefined}
          aria-haspopup={menuContent ? "menu" : undefined}
          aria-expanded={menuContent ? showingContextMenu : undefined}
          {...{ [CARD_NAV_ATTR]: isClickable ? "" : undefined }}
          style={jacketBg}
        >
          {songSearchMounted && (
            <Suspense fallback={null}>
              <SongSearch
                isOpen={pocketPickPendingForPlayer !== null}
                onSongSelect={(song, chart) => {
                  if (actionsEnabled && chart) {
                    iconCallbacks.onReplace(pocketPickPendingForPlayer!, chart);
                  }
                  setPocketPickPendingForPlayer(null);
                  refocusCard(true);
                }}
                onCancel={() => {
                  setPocketPickPendingForPlayer(null);
                  refocusCard(true);
                }}
              />
            </Suspense>
          )}
          <div className={styles.cardCenter}>
            {actionLabels}
            <CenterContent chart={replacedWith || chart} />
          </div>

          <Menu
            opened={showingContextMenu || !!openAction}
            onChange={(opened) => {
              if (!opened) {
                hideMenu();
                setOpenActionKey(null);
                // Mantine hands focus back from the dropdown, but an action
                // that leaves nothing to offer (a veto) drops the dropdown
                // before it can, and one that re-sorts the set moves this card
                // out from under the focus
                refocusCard();
              }
            }}
            position="top"
            withInitialFocusPlaceholder={!menuOpenedByKeyboard}
          >
            <Menu.Target>
              <div>
                <FooterContent chart={replacedWith || chart} />
              </div>
            </Menu.Target>
            {(openAction || menuContent) && (
              <Menu.Dropdown data-card-menu>
                {openAction ? openAction.content : menuContent}
              </Menu.Dropdown>
            )}
          </Menu>
        </div>
      </Popover.Target>
      <Popover.Dropdown style={{ padding: "0.5em" }}>
        This one!
      </Popover.Dropdown>
    </Popover>
  );
}

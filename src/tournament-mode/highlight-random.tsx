import { useSetAtom, useAtom, atom } from "jotai";
import { useDrawing } from "../drawing-context";
import { useCallback, useMemo } from "react";
import { pickRandomItem } from "../utils";
import {
  DrawnChart,
  EligibleChart,
  PlayerPickPlaceholder,
} from "../models/Drawing";

const randomHighlightedDrawnChartId = atom<string>();

/**
 * returns a function that will highlight an eligible chart
 * from the contextually current draw at random
 **/
export function useHighlightRandom() {
  const setHighlight = useSetAtom(randomHighlightedDrawnChartId);

  const charts = useDrawing((s) => s.charts);
  const bans = useDrawing((s) => s.bans);
  const picks = useDrawing((s) => s.pocketPicks);
  const winners = useDrawing((s) => s.winners);
  return useCallback(() => {
    const eligibleForPick = charts.filter(({ id, type }) => {
      // remove vetos and already played
      if (bans[id] || winners[id]) return false;
      // remove pick placeholders that haven't been filled in
      if (type === "PLACEHOLDER" && !picks[id]) return false;
      return true;
    });
    const [, pick] = pickRandomItem(eligibleForPick);
    if (!pick) return;
    setHighlight(pick.id);
  }, [charts, bans, picks, winners, setHighlight]);
}

export function useChartRandomSelected(
  chart: DrawnChart | EligibleChart | PlayerPickPlaceholder,
): [chartIsRandomlySelected: boolean, clearSelection: () => void] {
  const [currentHighlightedId, setHighlight] = useAtom(
    randomHighlightedDrawnChartId,
  );

  let highlighted = true;
  if (!("id" in chart) || chart.id !== currentHighlightedId) {
    highlighted = false;
  }
  return useMemo(
    () => [highlighted, () => setHighlight(undefined)],
    [highlighted, setHighlight],
  );
}

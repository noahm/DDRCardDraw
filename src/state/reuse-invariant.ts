import { CHART_DRAWN, EligibleChart } from "../models/Drawing";
import type { AppState } from "./root-reducer";

/**
 * Actions that can put a chart into the draw history. Anything else can't
 * violate the reuse rule, and checking every action would mean walking the
 * whole history on each ban, winner and label edit.
 */
const CHART_MUTATING_ACTIONS = new Set([
  "drawings/addDrawing",
  "drawings/addSubdraw",
  "drawings/addOneChart",
  "drawings/updateCharts",
  "drawings/updateOneChart",
  "drawings/banProtectReplace",
]);

/**
 * Marks a rejection as "someone else drew this first" rather than a generic
 * refusal, so the losing client can say something the user can act on. The
 * reason string is all that survives the trip back over the wire.
 */
export const REUSE_REJECTION_PREFIX = "chart already drawn in this event:";

export function isReuseRejection(reason: string): boolean {
  return reason.includes(REUSE_REJECTION_PREFIX);
}

export function couldViolateReuseRule(actionType: unknown): boolean {
  return (
    typeof actionType === "string" && CHART_MUTATING_ACTIONS.has(actionType)
  );
}

/**
 * Count how many times each chart appears across the whole draw history.
 *
 * Deliberately keyed on `chartKey` alone rather than the looser keys
 * {@link reuseKeysForChart} hands out: this decides whether to *refuse* a draw,
 * and the legacy fallback key can't tell two games' identically-named charts
 * apart. Over-matching there would reject a legitimate draw with no way for the
 * user to talk it out of it. Charts drawn before chart keys existed simply
 * don't participate.
 */
function countChartUses(state: Partial<AppState>): Map<string, number> {
  const counts = new Map<string, number>();
  function count(chart: EligibleChart) {
    if (!chart.chartKey) return;
    counts.set(chart.chartKey, (counts.get(chart.chartKey) || 0) + 1);
  }

  for (const id of state.drawings?.ids || []) {
    const drawing = state.drawings!.entities[id];
    if (!drawing) continue;
    for (const subDrawing of Object.values(drawing.subDrawings)) {
      for (const chart of subDrawing.charts) {
        if (chart.type === CHART_DRAWN) count(chart);
      }
    }
    // a pocket pick spends both charts: the one it replaced and the one it
    // brought in. See `selectChartUsage`.
    for (const pick of Object.values(drawing.pocketPicks)) {
      if (pick) count(pick.pick);
    }
  }
  return counts;
}

/**
 * Throws if `next` would reuse a chart the event has already spent.
 *
 * This is the half of the reuse rule that holds under concurrency. Draws
 * already exclude used charts before they happen, but two devices can draw at
 * the same time, each against a history that doesn't yet contain the other's
 * draw. The party server runs this same reducer bundle over the canonical
 * ordering, so the second draw to reach it throws here — which the server turns
 * into a `reject` that rolls the loser back, rather than letting both land.
 *
 * A duplicate that was *already* present is left alone: a room that ran for a
 * while with the rule off, then turned it on, must not become unusable, and
 * neither must one holding history drawn before chart keys existed.
 */
export function assertNoNewChartReuse(prev: Partial<AppState>, next: AppState) {
  if (!next.event?.settings?.preventChartReuse) return;

  const nextCounts = countChartUses(next);
  let prevCounts: Map<string, number> | undefined;
  for (const [chartKey, count] of nextCounts) {
    if (count < 2) continue;
    // only pay for the second pass once something actually looks duplicated
    prevCounts ||= countChartUses(prev);
    if ((prevCounts.get(chartKey) || 0) >= count) continue;
    throw new Error(`${REUSE_REJECTION_PREFIX} ${chartKey}`);
  }
}

import type { Middleware } from "@reduxjs/toolkit";
import { showReuseBlockedToast } from "../draw-state/error-toast";
import { couldViolateReuseRule, isReuseRejection } from "./reuse-invariant";

/**
 * Turns a refused action into a message instead of a crash.
 *
 * The root reducer throws when an action would break the chart reuse rule,
 * which is how the party server refuses one. On a client the same throw would
 * escape `dispatch` and take down whatever triggered it, so catch it here and
 * tell the user what happened. The action never applied, so there is nothing
 * to roll back.
 *
 * This is reachable in ordinary use, not just as a race: pocket picking a chart
 * the event has already drawn is exactly this, and refusing it is the point.
 *
 * Sits before the listener middleware that ships actions to the party server,
 * so an action refused locally is never sent.
 */
export const invariantGuardMiddleware: Middleware =
  () => (next) => (action) => {
    const type = (action as { type?: unknown } | null)?.type;
    // keep the blast radius to actions that can actually be refused — a thunk or
    // any other dispatchable should still fail loudly
    if (!couldViolateReuseRule(type)) {
      return next(action);
    }
    try {
      return next(action);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      if (!isReuseRejection(reason)) throw e;
      console.warn(`refused ${String(type)}:`, reason);
      showReuseBlockedToast();
    }
  };

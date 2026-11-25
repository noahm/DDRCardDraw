import { Error, WarningSign } from "@blueprintjs/icons";
import { useIntl } from "../hooks/useIntl";
import { toaster } from "../toaster";

/**
 * A draw came back empty.
 *
 * @param allUsed the pool was non-empty but every chart in it had already been
 * drawn this event — a different problem from a config that matches nothing,
 * and one the user fixes differently (draw from a wider pool, or turn the reuse
 * rule off), so say which it was.
 */
export function showDrawErrorToast(allUsed = false) {
  toaster.show(
    {
      message: <DrawErrorMessage allUsed={allUsed} />,
      intent: "danger",
      icon: <Error />,
    },
    "fail-draw",
  );
}

function DrawErrorMessage({ allUsed }: { allUsed: boolean }) {
  const { t } = useIntl();
  return t(allUsed ? "controls.invalidAllUsed" : "controls.invalid");
}

/**
 * An action was refused locally for reusing a chart the event already drew —
 * most often a pocket pick of a chart that's turned up somewhere else.
 */
export function showReuseBlockedToast() {
  toaster.show(
    {
      message: <ReuseBlockedMessage />,
      intent: "danger",
      icon: <Error />,
    },
    "reuse-blocked",
  );
}

function ReuseBlockedMessage() {
  const { t } = useIntl();
  return t("controls.chartAlreadyUsed");
}

/**
 * The draw succeeded but came up short, which the reuse rule makes routine as
 * an event burns through its pool. Silence here would look like the requested
 * count was simply ignored.
 */
export function showPartialDrawToast(drawn: number, requested: number) {
  toaster.show(
    {
      message: <PartialDrawMessage drawn={drawn} requested={requested} />,
      intent: "warning",
      icon: <WarningSign />,
    },
    "partial-draw",
  );
}

function PartialDrawMessage({
  drawn,
  requested,
}: {
  drawn: number;
  requested: number;
}) {
  const { t } = useIntl();
  return t("controls.partialDraw", { drawn, requested });
}

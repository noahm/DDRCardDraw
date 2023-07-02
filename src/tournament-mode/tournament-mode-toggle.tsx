import { Checkbox } from "@blueprintjs/core";
import { useDrawState } from "../draw-state";
import { useIntl } from "../hooks/useIntl";

export function TournamentModeToggle() {
  const toggle = useDrawState((s) => s.toggleTournamentMode);
  const enabled = useDrawState((s) => s.tournamentMode);
  const { t } = useIntl();

  return (
    <Checkbox
      checked={enabled}
      onChange={toggle}
      label={t("controls.playerLabels")}
    />
  );
}

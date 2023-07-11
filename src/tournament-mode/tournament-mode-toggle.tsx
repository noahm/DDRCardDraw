import { Checkbox } from "@blueprintjs/core";
import { useIntl } from "../hooks/useIntl";
import { useConfigState } from "../config-state";

export function TournamentModeToggle() {
  const update = useConfigState((s) => s.update);
  const enabled = useConfigState((s) => s.showLabels);
  const { t } = useIntl();

  return (
    <Checkbox
      checked={enabled}
      onChange={(e) => update({ showLabels: e.currentTarget.checked })}
      label={t("controls.playerLabels")}
    />
  );
}

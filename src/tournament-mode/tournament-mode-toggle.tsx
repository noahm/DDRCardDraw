import { MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { FormattedMessage } from "react-intl";
import { useDrawState } from "../draw-state";

export function TournamentModeToggle() {
  const toggle = useDrawState((s) => s.toggleTournamentMode);

  return (
    <MenuItem
      icon={IconNames.CROWN}
      text={
        <FormattedMessage
          id="toggle-tournament-mode"
          defaultMessage="Toggle Tournament Mode"
        />
      }
      onClick={toggle}
    />
  );
}

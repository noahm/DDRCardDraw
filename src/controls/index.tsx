import {
  Button,
  ButtonGroup,
  Dialog,
  Intent,
  Position,
  Tooltip,
} from "@blueprintjs/core";
import { NewLayers, Cog } from "@blueprintjs/icons";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import { useAppState } from "../state/store";
import { DrawDialog } from "./draw-dialog";

import { ConfigSelect } from "./config-select";
import { Link } from "react-router-dom";
export { ConfigSelect };

export function HeaderControls() {
  const [lastDrawFailed, setLastDrawFailed] = useState(false);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);
  const hasAnyConfig = useAppState((s) => !!s.config.ids.length);

  return (
    <>
      <Dialog
        isOpen={matchPickerOpen}
        title="New Draw"
        onClose={() => setMatchPickerOpen(false)}
      >
        <DrawDialog
          onClose={() => setMatchPickerOpen(false)}
          onDrawAttempt={(success) => setLastDrawFailed(!success)}
        />
      </Dialog>
      <ButtonGroup>
        <Tooltip
          isOpen={lastDrawFailed}
          content={<FormattedMessage id="controls.invalid" />}
          intent={Intent.DANGER}
          usePortal={false}
          position={Position.BOTTOM_RIGHT}
        >
          <Tooltip
            content="Create a config before drawing"
            disabled={hasAnyConfig}
          >
            <Button
              onClick={() => setMatchPickerOpen(true)}
              icon={<NewLayers />}
              intent={Intent.PRIMARY}
              disabled={!hasAnyConfig}
            >
              <FormattedMessage id="draw" />
            </Button>
          </Tooltip>
        </Tooltip>
        <Link to="config" data-umami-event="settings-open">
          <Button icon={<Cog />} />
        </Link>
      </ButtonGroup>
    </>
  );
}

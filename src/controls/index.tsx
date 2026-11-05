import { Button, Modal, Tooltip } from "@mantine/core";
import { IconStack2, IconSettings } from "@tabler/icons-react";
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
      <Modal
        opened={matchPickerOpen}
        title="New Draw"
        // wide enough that the draw source tabs stay on one row
        size="lg"
        onClose={() => setMatchPickerOpen(false)}
      >
        <DrawDialog
          onClose={() => setMatchPickerOpen(false)}
          onDrawAttempt={(success) => setLastDrawFailed(!success)}
        />
      </Modal>
      {/* joined as one control, the way the app has always shown them. The
          group only styles buttons that are its direct children, hence the
          settings link rendering as a Button itself */}
      <Button.Group>
        <Tooltip
          label={
            lastDrawFailed ? (
              <FormattedMessage id="controls.invalid" />
            ) : (
              "Create a config before drawing"
            )
          }
          color={lastDrawFailed ? "red" : undefined}
          opened={lastDrawFailed || undefined}
          disabled={!lastDrawFailed && hasAnyConfig}
          position="bottom-end"
        >
          <Button
            onClick={() => setMatchPickerOpen(true)}
            leftSection={<IconStack2 size={18} />}
            disabled={!hasAnyConfig}
          >
            <FormattedMessage id="draw" />
          </Button>
        </Tooltip>
        <Button
          component={Link}
          to="config"
          data-umami-event="settings-open"
          variant="default"
          aria-label="Settings"
          // square, to match the button height
          w="var(--button-height)"
          px={0}
        >
          <IconSettings size={18} />
        </Button>
      </Button.Group>
    </>
  );
}

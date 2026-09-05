import { ActionIcon, Button, Group, Modal, Tooltip } from "@mantine/core";
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
        onClose={() => setMatchPickerOpen(false)}
      >
        <DrawDialog
          onClose={() => setMatchPickerOpen(false)}
          onDrawAttempt={(success) => setLastDrawFailed(!success)}
        />
      </Modal>
      <Group gap="xs" wrap="nowrap">
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
        <Link to="config" data-umami-event="settings-open">
          <ActionIcon variant="default" size={36} aria-label="Settings">
            <IconSettings size={20} />
          </ActionIcon>
        </Link>
      </Group>
    </>
  );
}

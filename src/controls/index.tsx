import { ActionIcon, Button, Group, Modal, Tooltip } from "@mantine/core";
import { IconStack2, IconSettings } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { useHotkeys } from "@mantine/hooks";
import { FormattedMessage } from "react-intl";
import { useAppState } from "../state/store";
import { DrawDialog } from "./draw-dialog";

import { ConfigSelect } from "./config-select";
import { Link } from "react-router-dom";
import {
  firstGroupOnPage,
  focusNewestDrawWhenReady,
  NAV_HOME_ATTR,
} from "../utils/card-nav";
export { ConfigSelect };

export function HeaderControls() {
  const [lastDrawFailed, setLastDrawFailed] = useState(false);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);
  const hasAnyConfig = useAppState((s) => !!s.config.ids.length);
  const drawButtonRef = useRef<HTMLButtonElement>(null);
  /** the newest draw on the page when the dialog opened */
  const newestDrawRef = useRef<HTMLElement | null>(null);

  function openDrawDialog() {
    newestDrawRef.current = firstGroupOnPage();
    setMatchPickerOpen(true);
  }

  useHotkeys([
    [
      "n",
      (e) => {
        // not over another dialog, or from inside a card's menu
        const target = e.target as HTMLElement | null;
        if (!hasAnyConfig || target?.closest("[role=dialog], [role=menu]")) {
          return;
        }
        openDrawDialog();
      },
    ],
  ]);

  return (
    <>
      <Modal
        opened={matchPickerOpen}
        title="New Draw"
        // wide enough that the draw source tabs stay on one row
        size="lg"
        // focus goes to the new draw's first card instead, once it shows up
        returnFocus={false}
        onClose={() => {
          setMatchPickerOpen(false);
          drawButtonRef.current?.focus();
        }}
      >
        <DrawDialog
          onClose={() => setMatchPickerOpen(false)}
          onDrawAttempt={(success) => {
            setLastDrawFailed(!success);
            if (success) {
              focusNewestDrawWhenReady(newestDrawRef.current);
            } else {
              drawButtonRef.current?.focus();
            }
          }}
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
            ref={drawButtonRef}
            onClick={openDrawDialog}
            title="New draw (N)"
            {...{ [NAV_HOME_ATTR]: "" }}
            leftSection={<IconStack2 size={18} />}
            disabled={!hasAnyConfig}
          >
            <FormattedMessage id="draw" />
          </Button>
        </Tooltip>
        <ActionIcon
          component={Link}
          to="config"
          data-umami-event="settings-open"
          variant="default"
          size={36}
          aria-label="Settings"
        >
          <IconSettings size={20} />
        </ActionIcon>
      </Group>
    </>
  );
}

import { ActionIcon, Divider, Menu, Modal, Text } from "@mantine/core";
import {
  IconTrash,
  IconInfoCircle,
  IconMenu2,
  IconHelp,
  IconAdjustments,
  IconActivityHeartbeat,
  IconFileImport,
} from "@tabler/icons-react";
import { JSX, useCallback, useState } from "react";
import { useSetAtom } from "jotai";
import { About } from "./about";
import { customDataDialogOpen } from "./state/game-data.atoms";
import { HeaderControls } from "./controls";
import { useIntl } from "./hooks/useIntl";
import { LastUpdate } from "./last-update";
import { ThemeToggle, useInObs } from "./theme-toggle";
import { useAppDispatch, useAppState } from "./state/store";
import { drawingsSlice } from "./state/drawings.slice";
import { EventModeGated } from "./common-components/app-mode";
import { HeaderBar } from "./common-components/header-bar";
import { useNavigate, useHref } from "react-router-dom";
import { DiagnosticsDialog } from "./party/diagnostics-dialog";
import { useRoomName } from "./hooks/useRoomName";

export function Header({
  heading,
  controls,
}: {
  heading?: JSX.Element;
  controls?: JSX.Element;
}) {
  const inObs = useInObs();

  if (inObs) return null;

  return (
    <HeaderBar
      style={{
        position: "sticky",
        top: 0,
      }}
      left={
        <>
          <HamburgerMenu />
          <Divider orientation="vertical" />
          {heading || (
            <Text fw={600} component="span" style={{ whiteSpace: "nowrap" }}>
              Event Mode{" "}
              <small>
                <em>
                  <EventModeGated fallback="Classic Variant Alpha">
                    Alpha Preview
                  </EventModeGated>
                </em>
              </small>
            </Text>
          )}
        </>
      }
      right={controls || <HeaderControls />}
    />
  );
}

export function HamburgerMenu() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const openCustomDataDialog = useSetAtom(customDataDialogOpen);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const roomName = useRoomName();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const dashHref = useHref("dash", { relative: "route" });
  const clearDrawings = useCallback(
    () => dispatch(drawingsSlice.actions.clearDrawings()),
    [dispatch],
  );
  const haveDrawings = useAppState(drawingsSlice.selectors.haveDrawings);
  const { t } = useIntl();

  return (
    <>
      <Modal opened={aboutOpen} onClose={() => setAboutOpen(false)}>
        <About />
      </Modal>
      <DiagnosticsDialog
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        roomName={roomName}
      />
      <Menu position="bottom-start">
        <Menu.Target>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Menu"
            data-umami-event="hamburger-menu-open"
          >
            <IconMenu2 size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconAdjustments size={16} />}
            component="a"
            href={dashHref}
            onClick={(e) => {
              e.preventDefault();
              navigate("dash");
            }}
          >
            Stream Dashboard
          </Menu.Item>
          <Menu.Item
            leftSection={<IconTrash size={16} />}
            onClick={clearDrawings}
            disabled={!haveDrawings}
          >
            {t("clearDrawings")}
          </Menu.Item>
          <EventModeGated>
            <Menu.Item
              leftSection={<IconActivityHeartbeat size={16} />}
              onClick={() => setDiagnosticsOpen(true)}
              data-umami-event="party-diagnostics-open"
            >
              {t("party.diagnostics.menuItem")}
            </Menu.Item>
          </EventModeGated>
          <Menu.Item
            leftSection={<IconFileImport size={16} />}
            onClick={() => openCustomDataDialog(true)}
          >
            {t("createCustomData")}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconInfoCircle size={16} />}
            onClick={() => setAboutOpen(true)}
            data-umami-event="about-open"
          >
            {t("credits")}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconHelp size={16} />}
            component="a"
            target="_blank"
            href="https://github.com/noahm/DDRCardDraw/blob/main/docs/readme.md"
          >
            {t("help")}
          </Menu.Item>
          <ThemeToggle />
          <LastUpdate />
        </Menu.Dropdown>
      </Menu>
    </>
  );
}

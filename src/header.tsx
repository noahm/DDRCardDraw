import {
  Alignment,
  Button,
  Dialog,
  Menu,
  MenuItem,
  Navbar,
  Popover,
} from "@blueprintjs/core";
import { Trash, InfoSign, Menu as MenuIcon, Help } from "@blueprintjs/icons";
import { useCallback, useState } from "react";
import { About } from "./about";
import { HeaderControls } from "./controls";
import { useIntl } from "./hooks/useIntl";
import { LastUpdate } from "./last-update";
import { ThemeToggle } from "./theme-toggle";
import { DataLoadingSpinner, VersionSelect } from "./version-select";
import { useAppDispatch, useAppState } from "./state/store";
import { drawingsSlice } from "./state/drawings.slice";

export function Header() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const dispatch = useAppDispatch();
  const clearDrawings = useCallback(
    () => dispatch(drawingsSlice.actions.clearDrawings()),
    [dispatch],
  );
  const haveDrawings = useAppState(drawingsSlice.selectors.haveDrawings);
  const { t } = useIntl();

  const menu = (
    <Menu>
      <MenuItem
        icon={<Trash />}
        onClick={clearDrawings}
        text={t("clearDrawings")}
        disabled={!haveDrawings}
      />
      <MenuItem
        icon={<InfoSign />}
        onClick={() => setAboutOpen(true)}
        text={t("credits")}
        data-umami-event="about-open"
      />
      <MenuItem
        icon={<Help />}
        target="_blank"
        href="https://github.com/noahm/DDRCardDraw/blob/main/docs/readme.md"
        text={t("help")}
      />
      <ThemeToggle />
      <LastUpdate />
    </Menu>
  );

  return (
    <Navbar
      style={{
        position: "sticky",
        top: 0,
      }}
    >
      <Dialog isOpen={aboutOpen} onClose={() => setAboutOpen(false)}>
        <About />
      </Dialog>
      <Navbar.Group align={Alignment.LEFT}>
        <Popover content={menu} placement="bottom-start">
          <Button icon={<MenuIcon />} data-umami-event="hamburger-menu-open" />
        </Popover>
        <Navbar.Divider />
        <VersionSelect />
        <DataLoadingSpinner />
      </Navbar.Group>
      <Navbar.Group align={Alignment.RIGHT}>
        <HeaderControls />
      </Navbar.Group>
    </Navbar>
  );
}

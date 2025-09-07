import {
  Alignment,
  Button,
  Dialog,
  Menu,
  MenuItem,
  Navbar,
  Popover,
} from "@blueprintjs/core";
import {
  Trash,
  InfoSign,
  Menu as MenuIcon,
  Help,
  Control,
} from "@blueprintjs/icons";
import { useCallback, useState } from "react";
import { About } from "./about";
import { HeaderControls } from "./controls";
import { useIntl } from "./hooks/useIntl";
import { LastUpdate } from "./last-update";
import { ThemeToggle, useInObs } from "./theme-toggle";
import { useAppDispatch, useAppState } from "./state/store";
import { drawingsSlice } from "./state/drawings.slice";
import { EventModeGated } from "./common-components/app-mode";
import { useNavigate, useHref } from "react-router-dom";

export function Header() {
  const inObs = useInObs();
  const [aboutOpen, setAboutOpen] = useState(false);
  const navigate = useNavigate();
  const dashHref = useHref("dash", { relative: "route" });
  const dispatch = useAppDispatch();
  const clearDrawings = useCallback(
    () => dispatch(drawingsSlice.actions.clearDrawings()),
    [dispatch],
  );
  const haveDrawings = useAppState(drawingsSlice.selectors.haveDrawings);
  const { t } = useIntl();

  if (inObs) return null;

  const menu = (
    <Menu>
      <MenuItem
        icon={<Control />}
        text="Stream Dashboard"
        href={dashHref}
        onClick={(e) => {
          e.preventDefault();
          navigate("dash");
        }}
      />
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
        <Navbar.Heading>
          Event Mode{" "}
          <small>
            <em>
              <EventModeGated fallback="Classic Variant Alpha">
                Alpha Preview
              </EventModeGated>
            </em>
          </small>
        </Navbar.Heading>
      </Navbar.Group>
      <Navbar.Group align={Alignment.RIGHT}>
        <HeaderControls />
      </Navbar.Group>
    </Navbar>
  );
}

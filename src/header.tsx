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
import { JSX, useCallback, useState } from "react";
import { About } from "./about";
import { HeaderControls } from "./controls";
import { useIntl } from "./hooks/useIntl";
import { LastUpdate } from "./last-update";
import { ThemeToggle, useInObs } from "./theme-toggle";
import { useAppDispatch, useAppState } from "./state/store";
import { drawingsSlice } from "./state/drawings.slice";
import { EventModeGated } from "./common-components/app-mode";
import { useNavigate, useHref } from "react-router-dom";

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
    <Navbar
      style={{
        position: "sticky",
        top: 0,
      }}
    >
      <Navbar.Group align={Alignment.LEFT}>
        <HamburgerMenu />
        <Navbar.Divider />
        {heading || (
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
        )}
      </Navbar.Group>
      <Navbar.Group align={Alignment.RIGHT}>
        {controls || <HeaderControls />}
      </Navbar.Group>
    </Navbar>
  );
}

export function HamburgerMenu() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const dashHref = useHref("dash", { relative: "route" });
  const clearDrawings = useCallback(
    () => dispatch(drawingsSlice.actions.clearDrawings()),
    [dispatch],
  );
  const haveDrawings = useAppState(drawingsSlice.selectors.haveDrawings);
  const { t } = useIntl();

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
    <>
      <Dialog isOpen={aboutOpen} onClose={() => setAboutOpen(false)}>
        <About />
      </Dialog>
      <Popover content={menu} placement="bottom-start">
        <Button icon={<MenuIcon />} data-umami-event="hamburger-menu-open" />
      </Popover>
    </>
  );
}

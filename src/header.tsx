import {
  Button,
  Dialog,
  Drawer,
  Menu,
  MenuItem,
  Navbar,
  Position,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Popover2 } from "@blueprintjs/popover2";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import { About } from "./about";
import { HeaderControls } from "./controls";
import styles from "./header.css";
import { useDataSets } from "./hooks/useDataSets";
import { LastUpdate } from "./last-update";
import { ThemeToggle } from "./theme-toggle";
import { VersionSelect } from "./version-select";

function hasAnchorAncestor(e: HTMLElement): boolean {
  if (e.tagName === "A") {
    return true;
  }
  if (!e.parentElement) {
    return false;
  }
  return hasAnchorAncestor(e.parentElement);
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { current } = useDataSets();

  function toggleMenu() {
    setMenuOpen((isOpen) => !isOpen);
  }

  function maybeCloseMenu(e: React.MouseEvent<HTMLUListElement>) {
    hasAnchorAncestor(e.target as HTMLElement) && setMenuOpen(false);
  }

  const menu = (
    <div className={styles.menuContainer}>
      <Menu onClickCapture={maybeCloseMenu}>
        <MenuItem
          onClick={() => setAboutOpen(true)}
          icon={IconNames.ID_NUMBER}
          text={<FormattedMessage id="credits" />}
        />
        <ThemeToggle />
        <VersionSelect />
        <LastUpdate />
      </Menu>
    </div>
  );

  return (
    <Navbar
      id="HeaderNav"
      style={{
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <Dialog isOpen={aboutOpen} onClose={() => setAboutOpen(false)}>
        <About />
      </Dialog>
      <Navbar.Group>
        <Popover2
          content={menu}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          position={Position.BOTTOM_LEFT}
        >
          <Button icon={IconNames.MENU} onClick={() => setMenuOpen(true)} />
        </Popover2>
        <Navbar.Divider />
        {current.display}
      </Navbar.Group>
      <Navbar.Group>
        <HeaderControls />
      </Navbar.Group>
    </Navbar>
  );
}

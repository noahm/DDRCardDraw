import {
  Button,
  Dialog,
  Menu,
  Navbar,
  Position,
  Text,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Popover2, Tooltip2 } from "@blueprintjs/popover2";
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

  function maybeCloseMenu(e: React.MouseEvent<HTMLUListElement>) {
    hasAnchorAncestor(e.target as HTMLElement) && setMenuOpen(false);
  }

  const menu = (
    <div className={styles.menuContainer}>
      <Menu onClickCapture={maybeCloseMenu}>
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
        <Tooltip2
          content={<FormattedMessage id="credits" />}
          placement="bottom"
        >
          <Button
            minimal
            onClick={() => setAboutOpen(true)}
            icon={IconNames.INFO_SIGN}
          />
        </Tooltip2>
        <ThemeToggle />
        <Navbar.Divider />
        <Popover2
          content={menu}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          placement="bottom"
          shouldReturnFocusOnClose={false}
        >
          <Tooltip2 content="Change Song Data" placement="bottom">
            <Button icon={IconNames.MUSIC} onClick={() => setMenuOpen(true)} />
          </Tooltip2>
        </Popover2>{" "}
        <Text style={{ marginLeft: "0.5em" }}>{current.display}</Text>
      </Navbar.Group>
      <Navbar.Group>
        <HeaderControls />
      </Navbar.Group>
    </Navbar>
  );
}

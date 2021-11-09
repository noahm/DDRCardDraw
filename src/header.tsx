import { Button, Dialog, Menu, MenuItem, Navbar } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Popover2, Tooltip2 } from "@blueprintjs/popover2";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import { About } from "./about";
import { HeaderControls } from "./controls";
import styles from "./header.css";
import { useIntl } from "./hooks/useIntl";
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
  const { t } = useIntl();

  function maybeCloseMenu(e: React.MouseEvent<HTMLUListElement>) {
    hasAnchorAncestor(e.target as HTMLElement) && setMenuOpen(false);
  }

  const menu = (
    <div className={styles.menuContainer}>
      <Menu onClickCapture={maybeCloseMenu}>
        <MenuItem
          icon={IconNames.INFO_SIGN}
          onClick={() => setAboutOpen(true)}
          text={t("credits")}
        />
        <ThemeToggle />
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
        >
          <Button onClick={() => setMenuOpen(true)} icon={IconNames.MENU} />
        </Popover2>
        <Navbar.Divider />
        <Tooltip2 content="Change Song Data" placement="bottom">
          <VersionSelect />
        </Tooltip2>
      </Navbar.Group>
      <Navbar.Group>
        <HeaderControls />
      </Navbar.Group>
    </Navbar>
  );
}

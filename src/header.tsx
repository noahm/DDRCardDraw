import {
  Alignment,
  Button,
  Dialog,
  Menu,
  MenuItem,
  Navbar,
  Popover,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { useState } from "react";
import { About } from "./about";
import { HeaderControls } from "./controls";
import { useIntl } from "./hooks/useIntl";
import { LastUpdate } from "./last-update";
import { ThemeToggle } from "./theme-toggle";
import { DataLoadingSpinner, VersionSelect } from "./version-select";
import styles from "./header.css";

export function Header() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const { t } = useIntl();

  const menu = (
    <Menu>
      <MenuItem
        icon={IconNames.INFO_SIGN}
        onClick={() => setAboutOpen(true)}
        text={t("credits")}
      />
      <MenuItem
        icon="help"
        href="https://github.com/noahm/DDRCardDraw/blob/main/docs/index.md"
        text={t("help")}
      />
      <ThemeToggle />
      <LastUpdate />
    </Menu>
  );

  return (
    <Navbar
      className={styles.header}
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
          <Button icon={IconNames.MENU} />
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

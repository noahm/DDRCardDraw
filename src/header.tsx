import {
  Alignment,
  Button,
  Dialog,
  Menu,
  MenuItem,
  Navbar,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Popover2 } from "@blueprintjs/popover2";
import { useState } from "react";
import { About } from "./about";
import { HeaderControls } from "./controls";
import { useIntl } from "./hooks/useIntl";
import { LastUpdate } from "./last-update";
import { ThemeToggle } from "./theme-toggle";
import { DataLoadingSpinner, VersionSelect } from "./version-select";

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
        <Popover2 content={menu} placement="bottom-start">
          <Button icon={IconNames.MENU} />
        </Popover2>
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

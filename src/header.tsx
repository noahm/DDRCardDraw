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
import { useIntl } from "./hooks/useIntl";
import { LastUpdate } from "./last-update";
import { ThemeToggle } from "./theme-toggle";
import { DataLoadingSpinner, VersionSelect } from "./version-select";
import { useDrawState } from "./draw-state";

export function Header() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const clearDrawings = useDrawState((d) => d.clearDrawings);
  const haveDrawings = useDrawState((d) => !!d.drawings.length);
  const { t } = useIntl();

  const menu = (
    <Menu>
      <MenuItem
        icon={IconNames.Trash}
        onClick={clearDrawings}
        text={t("clearDrawings")}
        disabled={!haveDrawings}
      />
      <MenuItem
        icon={IconNames.INFO_SIGN}
        onClick={() => setAboutOpen(true)}
        text={t("credits")}
      />
      <MenuItem
        icon="help"
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
          <Button icon={IconNames.MENU} />
        </Popover>
        <Navbar.Divider />
        <VersionSelect />
        <DataLoadingSpinner />
      </Navbar.Group>
    </Navbar>
  );
}

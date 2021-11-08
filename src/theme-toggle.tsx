import { prefersDarkQuery } from "./hooks/useDarkThemePref";
import { useEffect, useState } from "react";
import { Classes, MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { FormattedMessage } from "react-intl";

enum Theme {
  Light = "light",
  Dark = "dark",
}

function getTheme() {
  return document.body.classList.contains(Classes.DARK)
    ? Theme.Dark
    : Theme.Light;
}

function applyTheme(dark: boolean) {
  document.body.classList.toggle(Classes.DARK, dark);
}

export function applySystemTheme() {
  applyTheme(prefersDarkQuery.matches);
}

export function ThemeToggle({}) {
  const [theme, setTheme] = useState<Theme>(getTheme());
  useEffect(() => {
    applyTheme(theme === Theme.Dark);
  }, [theme]);

  const icon = theme === Theme.Dark ? IconNames.FLASH : IconNames.MOON;

  return (
    <MenuItem
      icon={icon}
      text={
        <FormattedMessage id="toggle-theme" defaultMessage="Toggle Theme" />
      }
      onClick={() => setTheme(theme === Theme.Dark ? Theme.Light : Theme.Dark)}
    />
  );
}

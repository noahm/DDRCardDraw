import { useDarkThemePref } from "./hooks/useDarkThemePref";
import { useEffect, useState } from "react";
import { Button, Classes } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { FormattedMessage } from "react-intl";
import { Tooltip2 } from "@blueprintjs/popover2";

enum Theme {
  Light = "light",
  Dark = "dark",
}

function applyTheme(dark: boolean) {
  document.body.classList.toggle(Classes.DARK, dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | undefined>();
  const prefersDarkTheme = useDarkThemePref();
  const resolvedTheme = theme
    ? theme
    : prefersDarkTheme
    ? Theme.Dark
    : Theme.Light;

  useEffect(() => {
    applyTheme(resolvedTheme === Theme.Dark);
  }, [resolvedTheme]);

  const icon = resolvedTheme === Theme.Dark ? IconNames.FLASH : IconNames.MOON;

  return (
    <Tooltip2
      content={
        <FormattedMessage id="toggle-theme" defaultMessage="Toggle Theme" />
      }
      placement="bottom"
    >
      <Button
        minimal
        icon={icon}
        onClick={() =>
          setTheme(resolvedTheme === Theme.Dark ? Theme.Light : Theme.Dark)
        }
      />
    </Tooltip2>
  );
}

import { useEffect } from "react";
import { Classes, MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { FormattedMessage } from "react-intl";
import createStore from "zustand";
import { useMediaQuery } from "./hooks/useMediaQuery";

export const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export enum Theme {
  Light = "light",
  Dark = "dark",
}

/**
 * Returns true if user prefers dark theme
 */
export function useThemePref() {
  return useMediaQuery("(prefers-color-scheme: dark)")
    ? Theme.Dark
    : Theme.Light;
}

function applyTheme(theme: Theme) {
  document.body.classList.toggle(Classes.DARK, theme === Theme.Dark);
}

interface ThemeContext {
  userPref: Theme | undefined;
  resolved: Theme;
  updateBrowserPref(t: Theme): void;
  setTheme(t: Theme): void;
}

const useThemeStore = createStore<ThemeContext>((set, get) => ({
  userPref: undefined,
  resolved: darkQuery.matches ? Theme.Dark : Theme.Light,
  updateBrowserPref(t) {
    const state = get();
    if (!state.userPref && state.resolved !== t) {
      set({ resolved: t });
    }
  },
  setTheme(t) {
    set({ userPref: t, resolved: t });
  },
  set,
}));

/** hook to get current app theme */
export const useTheme = () => useThemeStore((s) => s.resolved);

export function ThemeSyncWidget() {
  const themeState = useThemeStore();
  const browserPref = useThemePref();
  useEffect(() => {
    applyTheme(themeState.resolved);
  }, [themeState.resolved]);
  useEffect(() => {
    themeState.updateBrowserPref(browserPref);
  }, [themeState.updateBrowserPref, browserPref]);
  return null;
}

export function ThemeToggle() {
  const resolvedTheme = useThemeStore((t) => t.resolved);
  const setTheme = useThemeStore((t) => t.setTheme);

  const icon = resolvedTheme === Theme.Dark ? IconNames.FLASH : IconNames.MOON;

  return (
    <MenuItem
      icon={icon}
      text={
        <FormattedMessage id="toggle-theme" defaultMessage="Toggle Theme" />
      }
      onClick={() =>
        setTheme(resolvedTheme === Theme.Dark ? Theme.Light : Theme.Dark)
      }
    />
  );
}

import { useEffect } from "react";
import { Classes, MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { FormattedMessage } from "react-intl";
import { create } from "zustand";
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

function applyThemeBodyClass(theme: Theme, isObsLayer: boolean) {
  document.body.classList.toggle(Classes.DARK, theme === Theme.Dark);
  document.body.classList.toggle("obs-layer", isObsLayer);
}

interface ThemeContext {
  /** is this instance operating as a layer inside OBS */
  obsLayer: boolean;
  setObsLayer(next: boolean): void;
  userPref: Theme | undefined;
  resolved: Theme;
  updateBrowserPref(t: Theme): void;
  setTheme(t: Theme): void;
}

// we may be loaded into a browser source of OBS studio,
// which we can detect by looking for the API they inject
// into the page. see more:
// https://github.com/obsproject/obs-browser/blob/master/README.md
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace obsstudio {
    const pluginVersion: string;
  }
}

const useThemeStore = create<ThemeContext>((set, get) => ({
  obsLayer: typeof window.obsstudio !== "undefined",
  setObsLayer(next) {
    set({ obsLayer: next });
  },
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
}));

/** hook to get current app theme */
export const useTheme = () => useThemeStore((s) => s.resolved);

export function ThemeSyncWidget() {
  const {
    resolved: resolvedTheme,
    obsLayer: isOBS,
    updateBrowserPref,
  } = useThemeStore();
  const browserPref = useThemePref();
  useEffect(() => {
    applyThemeBodyClass(resolvedTheme, isOBS);
  }, [resolvedTheme, isOBS]);
  useEffect(() => {
    updateBrowserPref(browserPref);
  }, [updateBrowserPref, browserPref]);
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

export function ObsToggle() {
  const set = useThemeStore((t) => t.setObsLayer);

  return (
    <MenuItem
      icon={IconNames.EyeOff}
      text={<FormattedMessage id="toggle-obs-layer" defaultMessage="Hide UI" />}
      onClick={() => set(true)}
    />
  );
}

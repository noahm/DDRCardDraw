import { useEffect } from "react";
import { Menu } from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { FormattedMessage } from "react-intl";
import { create } from "zustand";
import { useMediaQuery } from "./hooks/useMediaQuery";

export const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export type Theme = "light" | "dark";

/**
 * Returns true if user prefers dark theme
 */
export function useThemePref() {
  return useMediaQuery("(prefers-color-scheme: dark)") ? "dark" : "light";
}

function applyThemeBodyClass(isOBSSource: boolean) {
  document.body.classList.toggle("obs-layer", isOBSSource);
}

interface ThemeContext {
  /** is this instance loaded in OBS (either browser source or dock) */
  inObs: boolean;
  /** is this instance operating as a browser source inside OBS */
  obsBrowserSource: boolean;
  setIsObsSource(next: boolean): void;
  userPref: Theme | undefined;
  resolved: Theme;
  updateBrowserPref(this: void, t: Theme): void;
  setTheme(this: void, t: Theme): void;
}

// we may be loaded into a browser source of OBS studio,
// which we can detect by looking for the API they inject
// into the page. see more:
// https://github.com/obsproject/obs-browser/blob/master/README.md
declare global {
  // oxlint-disable-next-line typescript/no-namespace
  namespace obsstudio {
    const pluginVersion: string;
    const getControlLevel: (cb: (level: number) => void) => void;
  }
}

const useThemeStore = create<ThemeContext>((set, get) => ({
  inObs: !!window.obsstudio,
  obsBrowserSource: false,
  setIsObsSource(next) {
    set({ obsBrowserSource: next });
  },
  userPref: undefined,
  resolved: darkQuery.matches ? "dark" : "light",
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

// based on https://github.com/obsproject/obs-browser/issues/455#issuecomment-2351761820
// there's no built-in way to distinguish between a browser source and a dock,
// but in a dock some basic APIs are just stubbed, so this `getControlLevel` function
// never calls the provided callback.
// this results in detection of OBS delayed until we get the CB, but that will be adequate.
if (window.obsstudio) {
  window.obsstudio.getControlLevel(() => {
    useThemeStore.getState().setIsObsSource(true);
  });
}

export const useInObs = () => useThemeStore((s) => s.inObs);
export const useInObsSource = () => useThemeStore((s) => s.obsBrowserSource);

/** hook to get current app theme */
export const useTheme = () => useThemeStore((s) => s.resolved);

export function ThemeSyncWidget() {
  const { obsBrowserSource: isOBSSource, updateBrowserPref } = useThemeStore();
  const browserPref = useThemePref();
  useEffect(() => {
    applyThemeBodyClass(isOBSSource);
  }, [isOBSSource]);
  useEffect(() => {
    updateBrowserPref(browserPref);
  }, [updateBrowserPref, browserPref]);
  return null;
}

export function ThemeToggle() {
  const resolvedTheme = useThemeStore((t) => t.resolved);
  const setTheme = useThemeStore((t) => t.setTheme);

  const ThemeIcon = resolvedTheme === "dark" ? IconSun : IconMoon;

  return (
    <Menu.Item
      leftSection={<ThemeIcon size={16} />}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <FormattedMessage id="toggleTheme" defaultMessage="Toggle Theme" />
    </Menu.Item>
  );
}

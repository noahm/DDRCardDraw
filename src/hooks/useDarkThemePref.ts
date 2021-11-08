import { useState, useEffect } from "react";

export const prefersDarkQuery = window.matchMedia(
  "(prefers-color-scheme: dark)"
);

/**
 * Returns true if user prefers dark theme
 */
export function useDarkThemePref() {
  const [matches, setMatches] = useState(prefersDarkQuery.matches);
  useEffect(() => {
    function handleThemeChange(a: MediaQueryListEvent) {
      setMatches(a.matches);
    }
    prefersDarkQuery.addListener(handleThemeChange);
    return () => {
      prefersDarkQuery.removeListener(handleThemeChange);
    };
  }, []);

  return matches;
}

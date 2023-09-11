import { useState, useEffect, useMemo } from "react";

export const prefersDarkQuery = window.matchMedia(
  "(prefers-color-scheme: dark)",
);

/**
 * Returns true if matches a given query
 */
export function useMediaQuery(query: string) {
  const mq = useMemo(() => {
    return window.matchMedia(query);
  }, [query]);

  const [matching, setMatching] = useState(mq.matches);

  useEffect(() => {
    function handleChange(a: MediaQueryListEvent) {
      setMatching(a.matches);
    }
    if (matching !== mq.matches) {
      setMatching(mq.matches);
    }
    mq.addEventListener("change", handleChange);
    return () => {
      mq.removeEventListener("change", handleChange);
    };
  }, [matching, mq]);

  return matching;
}

export function useIsNarrow() {
  return useMediaQuery("(max-width: 600px)");
}

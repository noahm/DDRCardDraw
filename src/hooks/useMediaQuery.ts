import { useMemo, useSyncExternalStore } from "react";

/**
 * Returns true if matches a given query
 */
export function useMediaQuery(query: string) {
  const mq = useMemo(() => {
    return window.matchMedia(query);
  }, [query]);

  const matching = useSyncExternalStore(
    (handleChange) => {
      if (mq.addEventListener) {
        mq.addEventListener("change", handleChange);
      } else {
        // for old safari e.g. iOS 12
        mq.addListener(handleChange);
      }
      return () => {
        if (mq.removeEventListener) {
          mq.removeEventListener("change", handleChange);
        } else {
          // for old safari e.g. iOS 12
          mq.removeListener(handleChange);
        }
      };
    },
    () => mq.matches,
  );

  return matching;
}

export function useIsNarrow() {
  return useMediaQuery("(max-width: 600px)");
}

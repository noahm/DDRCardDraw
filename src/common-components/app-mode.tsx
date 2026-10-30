import { createContext, ReactNode, useContext } from "react";

const appModeContext = createContext<"classic" | "event">("event");

export function ClassicModeContext(props: { children: ReactNode }) {
  return (
    <appModeContext.Provider value="classic">
      {props.children}
    </appModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(appModeContext);
}

export function EventModeGated(props: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const mode = useAppMode();
  if (mode === "classic") {
    return props.fallback || null;
  }
  return props.children;
}

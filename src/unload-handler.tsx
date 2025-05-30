import { useEffect } from "react";

interface Props {
  confirmUnload: boolean;
}

export function UnloadHandler(props: Props) {
  useEffect(() => {
    if (!props.confirmUnload) {
      return;
    }
    window.addEventListener("beforeunload", promptUnsaved);
    return () => window.removeEventListener("beforeunload", promptUnsaved);
  }, [props.confirmUnload]);

  return null;
}

function promptUnsaved(e: BeforeUnloadEvent) {
  e.preventDefault();
}

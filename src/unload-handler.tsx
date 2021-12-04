import { useEffect } from "react";
import { useIntl } from "./hooks/useIntl";

interface Props {
  confirmUnload: boolean;
}

export function UnloadHandler(props: Props) {
  const { t } = useIntl();
  const confirmText = t("confirmClose");

  function handleUnload(e: BeforeUnloadEvent) {
    if (props.confirmUnload) {
      e.returnValue = confirmText;
    }
  }

  useEffect(() => {
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [props.confirmUnload, confirmText]);

  return null;
}

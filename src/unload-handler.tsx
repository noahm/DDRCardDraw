import { useEffect } from "react";
import { useIntl } from "./hooks/useIntl";

interface Props {
  confirmUnload: boolean;
}

export function UnloadHandler(props: Props) {
  const { t } = useIntl();
  const confirmText = t("confirmClose");

  useEffect(() => {
    function handleUnload(e: BeforeUnloadEvent) {
      if (props.confirmUnload) {
        e.returnValue = confirmText;
      }
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [props.confirmUnload, confirmText]);

  return null;
}

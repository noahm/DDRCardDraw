import { useContext, useEffect } from "preact/hooks";
import { TranslateContext } from "@denysvuika/preact-translate";

interface Props {
  confirmUnload: boolean;
}

export function UnloadHandler(props: Props) {
  const { t } = useContext(TranslateContext);
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

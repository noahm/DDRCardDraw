import { useContext, useEffect } from "preact/hooks";
import { TranslateContext } from "@denysvuika/preact-translate";

export function UnloadHandler(props) {
  const { t } = useContext(TranslateContext);
  const confirmText = t("confirmClose");

  function handleUnload(e) {
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

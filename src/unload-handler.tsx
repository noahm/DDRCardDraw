import { useEffect } from "react";
import { useIntl } from "./hooks/useIntl";
import { useDrawState } from "./draw-state/store";

interface Props {
  confirmUnload: boolean;
}

export function UnloadHandler(props: Props) {
  const { t } = useIntl();
  useEffect(() => {
    useDrawState.setState({ confirmMessage: t("clearDrawingsConfirm") });
  }, [t]);

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

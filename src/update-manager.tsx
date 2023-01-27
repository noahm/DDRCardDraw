import { useRegisterSW } from "virtual:pwa-register/react";
import { toaster } from "./toaster";
import { Intent } from "@blueprintjs/core";
import { useIntl } from "./hooks/useIntl";

export function UpdateManager() {
  const { t } = useIntl();
  useRegisterSW({
    onNeedRefresh() {
      toaster.clear();
      toaster.show(
        {
          message: t("updateReady"),
          intent: Intent.SUCCESS,
          timeout: 0,
          action: {
            text: t("applyUpdate"),
            onClick: () => window.location.reload(),
          },
        },
        "UpdateManger"
      );
    },
  });

  return null;
}

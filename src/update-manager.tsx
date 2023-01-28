import { useRegisterSW } from "virtual:pwa-register/react";
import { toaster } from "./toaster";
import { Intent } from "@blueprintjs/core";
import { useIntl } from "./hooks/useIntl";

const UPDATE_INTERVAL = 600_000;

export function UpdateManager() {
  const { t } = useIntl();
  const { updateServiceWorker } = useRegisterSW({
    onRegisteredSW(swScriptUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, UPDATE_INTERVAL);
      }
      registration?.addEventListener("updatefound", (ev) => {
        updateServiceWorker(false);
      });
    },
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

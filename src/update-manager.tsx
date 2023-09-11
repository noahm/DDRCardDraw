import * as OfflinePluginRuntime from "@lcdp/offline-plugin/runtime";
import { useEffect } from "react";
import { toaster } from "./toaster";
import { Intent } from "@blueprintjs/core";
import { useIntl } from "./hooks/useIntl";
import { IconNames } from "@blueprintjs/icons";

export function UpdateManager() {
  const { t } = useIntl();
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      OfflinePluginRuntime.install({
        onUpdateReady() {
          OfflinePluginRuntime.applyUpdate();
          toaster.show(
            {
              message: t("updateLoading"),
              intent: Intent.WARNING,
            },
            "UpdateManager",
          );
        },
        onUpdated() {
          toaster.clear();
          toaster.show(
            {
              message: t("updateReady"),
              icon: IconNames.OUTDATED,
              intent: Intent.SUCCESS,
              timeout: 0,
              action: {
                text: t("applyUpdate"),
                onClick: () => window.location.reload(),
              },
            },
            "UpdateManger",
          );
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

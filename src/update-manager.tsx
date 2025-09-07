import * as OfflinePluginRuntime from "@lcdp/offline-plugin/runtime";
import { useEffect } from "react";
import { toaster } from "./toaster";
import { Intent } from "@blueprintjs/core";
import { useIntl } from "./hooks/useIntl";
import { Outdated } from "@blueprintjs/icons";
import { useInObs } from "./theme-toggle";

export function UpdateManager() {
  const { t } = useIntl();
  const isObs = useInObs();
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      OfflinePluginRuntime.install({
        onUpdateReady() {
          OfflinePluginRuntime.applyUpdate();
          if (isObs) return;
          toaster.show(
            {
              message: t("updateLoading"),
              intent: Intent.WARNING,
            },
            "UpdateManager",
          );
        },
        onUpdated() {
          if (isObs) {
            window.location.reload();
            return;
          }
          toaster.clear();
          toaster.show(
            {
              message: t("updateReady"),
              icon: <Outdated />,
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

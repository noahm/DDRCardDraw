import * as OfflinePluginRuntime from "@lcdp/offline-plugin/runtime";
import { useEffect } from "react";
import { toaster } from "./toaster";
import { useIntl } from "./hooks/useIntl";
import { IconHistory } from "@tabler/icons-react";
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
              intent: "warning",
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
              icon: <IconHistory />,
              intent: "success",
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
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  return null;
}

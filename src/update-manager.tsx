import * as OfflinePluginRuntime from "offline-plugin/runtime";
import { useEffect } from "react";
import { toaster } from "./toaster";
import { Intent } from "@blueprintjs/core";
import { FormattedMessage } from "react-intl";

export function UpdateManager() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      OfflinePluginRuntime.install({
        onUpdateReady() {
          OfflinePluginRuntime.applyUpdate();
          toaster.show(
            {
              message: <FormattedMessage id="updateLoading" />,
              intent: Intent.WARNING,
              timeout: 0,
            },
            "UpdateManager"
          );
        },
        onUpdated() {
          toaster.show(
            {
              message: <FormattedMessage id="updateReady" />,
              intent: Intent.SUCCESS,
              action: {
                text: (
                  <FormattedMessage id="applyUpdate" defaultMessage="Apply" />
                ),
                onClick: () => window.location.reload(),
              },
            },
            "UpdateManger"
          );
        },
      });
    }
  }, []);

  return null;
}
